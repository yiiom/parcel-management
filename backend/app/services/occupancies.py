"""入住批次建立、查詢與結束；跨表更新共用交易。"""

from app.services.common import now
from app.services.base import BaseService


class OccupancyService(BaseService):
    def occupancies(self, uid, page, size):
        self.context.permissions.unit(uid)
        return self.page(
            self.all(
                "SELECT id,unit_id,started_at,ended_at,created_at FROM occupancies WHERE unit_id=%s ORDER BY id DESC",
                (uid,),
            ),
            page,
            size,
        )

    def create_occupancy(self, uid):
        self.context.permissions.unit(uid)
        oid = self.execute(
            "INSERT INTO occupancies (unit_id,started_at,created_at) VALUES (%s,%s,%s)",
            (uid, now(), now()),
        )
        return self.context.permissions.occupancy(oid)

    def end_occupancy(self, oid):
        occ = self.context.permissions.occupancy(oid)
        self.context.permissions.building(occ["building_id"])
        if occ["ended_at"] is not None:
            return occ
        stamp = now()
        self.update("occupancies", oid, dict(ended_at=stamp))
        self.execute(
            "UPDATE unit_memberships SET status='revoked',left_at=%s,revoked_by=%s WHERE occupancy_id=%s AND status IN ('active','exit_requested')",
            (stamp, self.user["id"], oid),
        )
        self.execute(
            "UPDATE unit_invite_codes SET disabled_at=%s WHERE occupancy_id=%s AND disabled_at IS NULL",
            (stamp, oid),
        )
        for p in self.all(
            "SELECT * FROM parcels WHERE occupancy_id=%s AND status IN ('pending','exception')",
            (oid,),
        ):
            self.context.pickups.cancel_waiting(p["id"])
            reason = "原住戶已搬離，待處理"
            if p["status"] == "exception" and p["exception_reason"]:
                reason = p["exception_reason"] + "\n" + reason
            self.update(
                "parcels",
                p["id"],
                dict(
                    status="exception",
                    exception_reason=reason,
                    exception_reported_by=self.user["id"],
                    exception_reported_at=stamp,
                    resolution_note=None,
                    resolved_by=None,
                    resolved_at=None,
                    updated_at=stamp,
                ),
            )
        return self.context.permissions.occupancy(oid)
