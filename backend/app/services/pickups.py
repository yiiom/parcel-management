"""領取驗證、取消、住戶簽收與領取紀錄。"""

from datetime import timedelta
from app.core.errors import APIError
from app.core import codes
from app.services.common import now
from app.services.common import fail
from app.services.base import BaseService


class PickupService(BaseService):
    def expire_verifications(self, pid):
        self.execute(
            "UPDATE pickup_verifications SET status='expired',updated_at=%s WHERE parcel_id=%s AND status='awaiting_confirmation' AND expires_at<=%s",
            (now(), pid, now()),
        )

    def cancel_waiting(self, pid):
        self.expire_verifications(pid)
        self.execute(
            "UPDATE pickup_verifications SET status='cancelled',updated_at=%s WHERE parcel_id=%s AND status='awaiting_confirmation'",
            (now(), pid),
        )

    def verification_view(self, r):
        p = self.context.parcels.parcel(r["parcel_id"], False)
        occ = self.context.permissions.occupancy(p["occupancy_id"])
        pickup = self.one(
            "SELECT id FROM parcel_pickups WHERE verification_id=%s", (r["id"],)
        )
        status = (
            "expired"
            if r["status"] == "awaiting_confirmation" and r["expires_at"] <= now()
            else r["status"]
        )
        return {
            **{
                k: r[k]
                for k in (
                    "id",
                    "parcel_id",
                    "verified_by",
                    "verified_at",
                    "expires_at",
                    "updated_at",
                )
            },
            "status": status,
            "unit_label": self.label(occ),
            "courier": p["courier"],
            "pickup_id": pickup["id"] if pickup else None,
        }

    def verify_pickup(self, data):
        self.context.permissions.building(data.building_id)
        self.context.code_attempts.guard_code("pickup")
        p = self.one(
            "SELECT p.* FROM parcels p JOIN occupancies o ON o.id=p.occupancy_id WHERE p.code_building_id=%s AND p.pickup_code_hash=%s AND p.status='pending' AND o.ended_at IS NULL",
            (data.building_id, codes.digest("pickup", data.pickup_code)),
        )
        self.context.code_attempts.code_result("pickup", bool(p))
        self.expire_verifications(p["id"])
        existing = self.one(
            "SELECT * FROM pickup_verifications WHERE parcel_id=%s AND status='awaiting_confirmation'",
            (p["id"],),
        )
        if existing:
            if existing["verified_by"] != self.user["id"]:
                fail(409, "其他管理員正在處理此包裹。")
            return self.verification_view(existing)
        stamp = now()
        vid = self.execute(
            "INSERT INTO pickup_verifications (parcel_id,verified_by,verified_at,expires_at,status,updated_at) VALUES (%s,%s,%s,%s,'awaiting_confirmation',%s)",
            (p["id"], self.user["id"], stamp, stamp + timedelta(minutes=10), stamp),
        )
        return self.verification_view(
            self.one("SELECT * FROM pickup_verifications WHERE id=%s", (vid,))
        )

    def verification(self, vid):
        r = self.one("SELECT * FROM pickup_verifications WHERE id=%s", (vid,), True)
        self.context.parcels.parcel(r["parcel_id"])
        if (
            self.user["role"] == "building_admin"
            and r["verified_by"] != self.user["id"]
        ):
            fail(403, "只能查詢自己經手的驗證。")
        self.expire_verifications(r["parcel_id"])
        return self.one("SELECT * FROM pickup_verifications WHERE id=%s", (vid,))

    def cancel_verification(self, vid):
        self.context.permissions.role("building_admin")
        r = self.verification(vid)
        if r["status"] == "completed":
            fail(409, "已簽收，不能取消。")
        if r["status"] == "awaiting_confirmation":
            self.update(
                "pickup_verifications", vid, dict(status="cancelled", updated_at=now())
            )
        return self.verification_view(
            self.one("SELECT * FROM pickup_verifications WHERE id=%s", (vid,))
        )

    def pickup_view(self, r):
        p = self.context.parcels.parcel(r["parcel_id"], False)
        occ = self.context.permissions.occupancy(p["occupancy_id"])
        b = self.one("SELECT name FROM buildings WHERE id=%s", (occ["building_id"],))
        v = self.one(
            "SELECT verified_by FROM pickup_verifications WHERE id=%s",
            (r["verification_id"],),
        )
        return {
            **{
                k: r[k]
                for k in (
                    "id",
                    "parcel_id",
                    "verification_id",
                    "picked_up_by",
                    "picked_up_at",
                )
            },
            "picked_up_by_name": r["picked_up_by_name_snapshot"],
            "handled_by_name": r["handled_by_name_snapshot"],
            "handled_by": v["verified_by"],
            "unit_label": self.label(occ),
            "occupancy_id": occ["id"],
            "building_name": b["name"],
            "floor": occ["floor"],
            "recipient_name": p["recipient_name"],
            "courier": p["courier"],
            "tracking_number": p["tracking_number"],
        }

    def confirm(self, vid):
        self.context.permissions.role("resident")
        r = self.verification(vid)  # 先查當下權限，再處理重試。
        existing = self.one(
            "SELECT * FROM parcel_pickups WHERE verification_id=%s", (vid,)
        )
        if existing:
            if existing["picked_up_by"] != self.user["id"]:
                fail(409, "此包裹已由其他成員簽收。")
            return self.pickup_view(existing)
        if r["status"] == "expired":
            fail(410, "驗證已過期，請重新核對。")
        if r["status"] != "awaiting_confirmation":
            fail(409, "驗證已取消或已完成。")
        p = self.context.parcels.parcel(r["parcel_id"])
        if p["status"] != "pending":
            fail()
        handler = self.one(
            "SELECT name FROM users WHERE id=%s", (r["verified_by"],), True
        )
        stamp = now()
        pid = self.execute(
            "INSERT INTO parcel_pickups (parcel_id,verification_id,picked_up_by,picked_up_at,picked_up_by_name_snapshot,handled_by_name_snapshot) VALUES (%s,%s,%s,%s,%s,%s)",
            (p["id"], vid, self.user["id"], stamp, self.user["name"], handler["name"]),
        )
        self.update("parcels", p["id"], dict(status="picked_up", updated_at=stamp))
        self.update(
            "pickup_verifications", vid, dict(status="completed", updated_at=stamp)
        )
        return self.pickup_view(
            self.one("SELECT * FROM parcel_pickups WHERE id=%s", (pid,))
        )

    def pickups(self, page, size, bid, uid, oid, date_from, date_to):
        if date_from and date_to and date_from > date_to:
            raise APIError(422, "VALIDATION_ERROR", "起始日期不可晚於結束日期。")
        parcels = self.context.parcels.scope_rows()
        ids = {
            r["id"]
            for r in parcels
            if (bid is None or r["building_id"] == bid)
            and (uid is None or r["unit_id"] == uid)
            and (oid is None or r["occupancy_id"] == oid)
        }
        rows = self.all(
            "SELECT * FROM parcel_pickups ORDER BY picked_up_at DESC,id DESC"
        )
        # 查詢日期按臺灣日期（UTC+8）且含迄日，避免本機時區差異。
        rows = [
            r
            for r in rows
            if r["parcel_id"] in ids
            and (
                date_from is None
                or (r["picked_up_at"] + timedelta(hours=8)).date() >= date_from
            )
            and (
                date_to is None
                or (r["picked_up_at"] + timedelta(hours=8)).date() <= date_to
            )
        ]
        return self.page([self.pickup_view(r) for r in rows], page, size)
