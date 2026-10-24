"""邀請碼建立、停用、驗證與加入入住。"""

import secrets
from datetime import timedelta
from app.core import codes
from app.services.common import now
from app.services.common import fail
from app.services.base import BaseService


class InvitationService(BaseService):
    def invite_view(self, r):
        ended = self.context.permissions.occupancy(r["occupancy_id"])["ended_at"]
        status = (
            "inactive"
            if r["disabled_at"] or ended
            else "expired" if r["expires_at"] <= now() else "active"
        )
        return {
            **{
                k: r[k]
                for k in (
                    "id",
                    "occupancy_id",
                    "expires_at",
                    "disabled_at",
                    "created_by",
                    "created_at",
                )
            },
            "status": status,
        }

    def invites(self, oid, page, size):
        self.context.permissions.building(self.context.permissions.occupancy(oid)["building_id"])
        return self.page(
            [
                self.invite_view(r)
                for r in self.all(
                    "SELECT * FROM unit_invite_codes WHERE occupancy_id=%s ORDER BY id DESC",
                    (oid,),
                )
            ],
            page,
            size,
        )

    def create_invite(self, oid):
        occ = self.context.permissions.occupancy(oid, True)
        self.context.permissions.building(occ["building_id"])
        # 清除已到期的唯一鍵占位；原始狀態仍由期限推導。
        self.execute(
            "UPDATE unit_invite_codes SET released_at=expires_at WHERE released_at IS NULL AND expires_at<=%s",
            (now(),),
        )
        used = {
            r["code_hash"]
            for r in self.all(
                "SELECT code_hash FROM unit_invite_codes WHERE disabled_at IS NULL AND released_at IS NULL"
            )
        }
        start = secrets.randbelow(10000)
        code = None
        for offset in range(10000):
            candidate = f"{(start + offset) % 10000:04d}"
            if codes.digest("invite", candidate) not in used:
                code = candidate
                break
        if code is None:
            fail(409, "有效邀請碼空間已滿，請稍後重試。")
        self.execute(
            "UPDATE unit_invite_codes SET disabled_at=%s WHERE occupancy_id=%s AND disabled_at IS NULL",
            (now(), oid),
        )
        timestamp = now()
        iid = self.execute(
            "INSERT INTO unit_invite_codes (occupancy_id,code_hash,expires_at,created_by,created_at) VALUES (%s,%s,%s,%s,%s)",
            (
                oid,
                codes.digest("invite", code),
                timestamp + timedelta(hours=24),
                self.user["id"],
                timestamp,
            ),
        )
        return dict(
            self.invite_view(
                self.one("SELECT * FROM unit_invite_codes WHERE id=%s", (iid,))
            ),
            code=code,
        )

    def deactivate_invite(self, iid):
        r = self.one("SELECT * FROM unit_invite_codes WHERE id=%s", (iid,), True)
        self.context.permissions.building(self.context.permissions.occupancy(r["occupancy_id"])["building_id"])
        if r["disabled_at"] is None:
            self.update("unit_invite_codes", iid, {"disabled_at": now()})
        return self.invite_view(
            self.one("SELECT * FROM unit_invite_codes WHERE id=%s", (iid,))
        )

    def verify_invite(self, code, join=False):
        self.context.permissions.role("resident")
        self.context.code_attempts.guard_code("invite")
        r = self.one(
            "SELECT i.* FROM unit_invite_codes i JOIN occupancies o ON o.id=i.occupancy_id WHERE i.code_hash=%s AND i.disabled_at IS NULL AND i.expires_at>%s AND o.ended_at IS NULL",
            (codes.digest("invite", code), now()),
        )
        self.context.code_attempts.code_result("invite", bool(r))
        occ = self.context.permissions.occupancy(r["occupancy_id"], True)
        b = self.one("SELECT name FROM buildings WHERE id=%s", (occ["building_id"],))
        if not join:
            return dict(
                building_id=occ["building_id"],
                building_name=b["name"],
                unit_id=occ["unit_id"],
                unit_label=self.label(occ),
                occupancy_id=occ["id"],
                expires_at=r["expires_at"],
            )
        existing = self.one(
            "SELECT * FROM unit_memberships WHERE user_id=%s AND status IN ('active','exit_requested')",
            (self.user["id"],),
        )
        if existing:
            if existing["occupancy_id"] != occ["id"]:
                fail(409, "你已有其他有效入住資格。")
            return self.context.memberships.member_view(existing), False
        mid = self.execute(
            "INSERT INTO unit_memberships (user_id,occupancy_id,status,joined_at) VALUES (%s,%s,'active',%s)",
            (self.user["id"], occ["id"], now()),
        )
        return (
            self.context.memberships.member_view(
                self.one("SELECT * FROM unit_memberships WHERE id=%s", (mid,))
            ),
            True,
        )
