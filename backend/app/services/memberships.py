"""住戶資格、退出申請及本人關聯。"""

from app.services.common import now
from app.services.common import fail
from app.services.base import BaseService


class MembershipService(BaseService):
    def member_view(self, r):
        occ = self.context.permissions.occupancy(r["occupancy_id"])
        b = self.one("SELECT name FROM buildings WHERE id=%s", (occ["building_id"],))
        u = self.one("SELECT name FROM users WHERE id=%s", (r["user_id"],))
        return {
            **{
                k: r[k]
                for k in (
                    "id",
                    "user_id",
                    "occupancy_id",
                    "status",
                    "joined_at",
                    "exit_requested_at",
                    "left_at",
                    "revoked_by",
                )
            },
            "user_name": u["name"],
            "building_id": occ["building_id"],
            "building_name": b["name"],
            "unit_id": occ["unit_id"],
            "unit_label": self.label(occ),
        }

    def memberships(self, bid, page, size, unit_id, status, occupancy_id):
        self.context.permissions.building(bid)
        rows = self.all(
            "SELECT m.*,o.unit_id FROM unit_memberships m JOIN occupancies o ON o.id=m.occupancy_id JOIN units u ON u.id=o.unit_id WHERE u.building_id=%s ORDER BY m.id DESC",
            (bid,),
        )
        return self.page(
            [
                self.member_view(r)
                for r in rows
                if (unit_id is None or r["unit_id"] == unit_id)
                and (status is None or r["status"] == status)
                and (occupancy_id is None or r["occupancy_id"] == occupancy_id)
            ],
            page,
            size,
        )

    def me(self):
        rows = self.all(
            "SELECT m.* FROM unit_memberships m JOIN occupancies o ON o.id=m.occupancy_id WHERE m.user_id=%s AND m.status IN ('active','exit_requested') AND o.ended_at IS NULL",
            (self.user["id"],),
        )
        return dict(
            memberships=[self.member_view(r) for r in rows],
            managed_building_ids=[
                r["building_id"]
                for r in self.all(
                    "SELECT building_id FROM building_admins WHERE user_id=%s",
                    (self.user["id"],),
                )
            ],
        )

    def request_exit(self, mid):
        r = self.one("SELECT * FROM unit_memberships WHERE id=%s", (mid,), True)
        self.context.permissions.membership_access(r["occupancy_id"])
        if r["user_id"] != self.user["id"]:
            fail(403, "只能申請自己的退出。")
        if r["status"] == "revoked":
            fail(409, "資格已取消。")
        if r["status"] == "active":
            self.update(
                "unit_memberships",
                mid,
                dict(status="exit_requested", exit_requested_at=now()),
            )
        return self.member_view(
            self.one("SELECT * FROM unit_memberships WHERE id=%s", (mid,))
        )

    def revoke(self, mid):
        r = self.one("SELECT * FROM unit_memberships WHERE id=%s", (mid,), True)
        self.context.permissions.building(self.context.permissions.occupancy(r["occupancy_id"])["building_id"])
        if r["status"] != "revoked":
            self.update(
                "unit_memberships",
                mid,
                dict(status="revoked", left_at=now(), revoked_by=self.user["id"]),
            )
            self.execute(
                "UPDATE unit_invite_codes SET disabled_at=%s WHERE occupancy_id=%s AND disabled_at IS NULL",
                (now(), r["occupancy_id"]),
            )
        return self.member_view(
            self.one("SELECT * FROM unit_memberships WHERE id=%s", (mid,))
        )
