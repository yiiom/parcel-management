"""包裹異常登記、恢復待領及退回。"""

from app.services.common import now
from app.services.common import fail
from app.services.base import BaseService


class ExceptionService(BaseService):
    def report_exception(self, pid, reason):
        self.context.permissions.role("building_admin")
        p = self.context.parcels.parcel(pid)
        if p["status"] not in ("pending", "exception"):
            fail()
        self.context.pickups.cancel_waiting(pid)
        self.update(
            "parcels",
            pid,
            dict(
                status="exception",
                exception_reason=reason,
                exception_reported_by=self.user["id"],
                exception_reported_at=now(),
                resolution_note=None,
                resolved_by=None,
                resolved_at=None,
                updated_at=now(),
            ),
        )
        return self.context.parcels.parcel_view(self.context.parcels.parcel(pid))

    def resolve_exception(self, pid, data):
        self.context.permissions.role("building_admin")
        p = self.context.parcels.parcel(pid)
        if p["status"] != "exception":
            fail()
        occ = self.context.permissions.occupancy(p["occupancy_id"])
        values = dict(
            status=data.status,
            resolution_note=data.resolution_note,
            resolved_by=self.user["id"],
            resolved_at=now(),
            updated_at=now(),
        )
        if data.status == "pending":
            if occ["ended_at"] is not None:
                fail(409, "入住已結束，只能退回。")
            enc, hashed = self.context.parcels.new_pickup_code(
                occ["building_id"], p["pickup_code_hash"]
            )
            values.update(pickup_code_encrypted=enc, pickup_code_hash=hashed)
        self.context.pickups.cancel_waiting(pid)
        self.update("parcels", pid, values)
        return self.context.parcels.parcel_view(self.context.parcels.parcel(pid))
