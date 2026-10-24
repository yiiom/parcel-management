"""包裹登記、查詢、修改與領取碼。"""

import secrets
from app.core import codes
from app.services.common import now
from app.services.common import fail
from app.services.base import BaseService


class ParcelService(BaseService):
    def parcel(self, pid, access=True):
        r = self.one("SELECT * FROM parcels WHERE id=%s", (pid,), True)
        occ = self.context.permissions.occupancy(r["occupancy_id"])
        if access:
            if self.user["role"] == "building_admin":
                self.context.permissions.building(occ["building_id"])
            else:
                self.context.permissions.membership_access(r["occupancy_id"])
        return r

    def parcel_view(self, r):
        occ = self.context.permissions.occupancy(r["occupancy_id"])
        active = self.one(
            "SELECT id FROM pickup_verifications WHERE parcel_id=%s AND status='awaiting_confirmation' AND expires_at>%s",
            (r["id"], now()),
        )
        pickup = self.one(
            "SELECT picked_up_at FROM parcel_pickups WHERE parcel_id=%s", (r["id"],)
        )
        fields = (
            "id",
            "occupancy_id",
            "recipient_name",
            "courier",
            "tracking_number",
            "storage_location",
            "note",
            "status",
            "created_by",
            "created_at",
            "updated_at",
            "exception_reason",
            "exception_reported_by",
            "exception_reported_at",
            "resolution_note",
            "resolved_by",
            "resolved_at",
        )
        return {
            **{k: r[k] for k in fields},
            "building_id": occ["building_id"],
            "unit_id": occ["unit_id"],
            "unit_label": self.label(occ),
            "active_verification_id": active["id"] if active else None,
            "picked_up_at": pickup["picked_up_at"] if pickup else None,
        }

    def scope_rows(self):
        self.context.permissions.role("building_admin", "resident")
        if self.user["role"] == "building_admin":
            return self.all(
                "SELECT p.*,u.building_id,u.id unit_id,u.unit_number FROM parcels p JOIN occupancies o ON o.id=p.occupancy_id JOIN units u ON u.id=o.unit_id JOIN building_admins a ON a.building_id=u.building_id WHERE a.user_id=%s ORDER BY p.created_at DESC,p.id DESC",
                (self.user["id"],),
            )
        return self.all(
            "SELECT p.*,u.building_id,u.id unit_id,u.unit_number FROM parcels p JOIN occupancies o ON o.id=p.occupancy_id JOIN units u ON u.id=o.unit_id JOIN unit_memberships m ON m.occupancy_id=o.id WHERE m.user_id=%s AND m.status IN ('active','exit_requested') AND o.ended_at IS NULL ORDER BY p.created_at DESC,p.id DESC",
            (self.user["id"],),
        )

    def parcels(self, page, size, building_id, unit_id, status, keyword, occupancy_id):
        rows = self.scope_rows()
        for field, value in [
            ("building_id", building_id),
            ("unit_id", unit_id),
            ("status", status),
            ("occupancy_id", occupancy_id),
        ]:
            if value is not None:
                rows = [r for r in rows if r[field] == value]
        if keyword:
            rows = [
                r
                for r in rows
                if any(
                    keyword.casefold() in (r[k] or "").casefold()
                    for k in (
                        "courier",
                        "tracking_number",
                        "unit_number",
                        "recipient_name",
                    )
                )
            ]
        return self.page([self.parcel_view(r) for r in rows], page, size)

    def new_pickup_code(self, bid, old_hash=None):
        used = {
            r["pickup_code_hash"]
            for r in self.all(
                "SELECT pickup_code_hash FROM parcels WHERE code_building_id=%s AND status='pending'",
                (bid,),
            )
        }
        if old_hash:
            used.add(old_hash)
        start = secrets.randbelow(1000000)
        for i in range(1000000):
            code = f"{(start+i)%1000000:06d}"
            hashed = codes.digest("pickup", code)
            if hashed not in used:
                return codes.encrypt(code), hashed
        fail(409, "此大樓取件碼空間已滿。")

    def create_parcel(self, data):
        occ = self.context.permissions.occupancy(data.occupancy_id, True)
        self.context.permissions.building(occ["building_id"])
        if data.courier and data.tracking_number and not data.duplicate_confirmed:
            matches = self.all(
                "SELECT p.* FROM parcels p JOIN occupancies o ON o.id=p.occupancy_id JOIN units u ON u.id=o.unit_id WHERE u.building_id=%s AND p.courier=%s AND p.tracking_number=%s ORDER BY p.id DESC",
                (occ["building_id"], data.courier, data.tracking_number),
            )
            if matches:
                return (
                    dict(
                        code="DUPLICATE_PARCEL_CONFIRMATION_REQUIRED",
                        message="已有相同物流公司與單號，請核對後確認是否新增。",
                        existing_parcels=[self.parcel_view(r) for r in matches],
                    ),
                    409,
                )
        encrypted, hashed = self.new_pickup_code(occ["building_id"])
        pid = self.execute(
            "INSERT INTO parcels (occupancy_id,recipient_name,courier,tracking_number,storage_location,note,status,pickup_code_encrypted,pickup_code_hash,code_building_id,created_by,created_at,updated_at) VALUES (%s,%s,%s,%s,%s,%s,'pending',%s,%s,%s,%s,%s,%s)",
            (
                data.occupancy_id,
                data.recipient_name,
                data.courier,
                data.tracking_number,
                data.storage_location,
                data.note,
                encrypted,
                hashed,
                occ["building_id"],
                self.user["id"],
                now(),
                now(),
            ),
        )
        return self.parcel_view(self.parcel(pid)), 201

    def update_parcel(self, pid, data):
        self.context.permissions.role("building_admin")
        r = self.parcel(pid)
        if r["status"] not in ("pending", "exception"):
            fail()
        values = data.model_dump(exclude_unset=True)
        changed = {k: v for k, v in values.items() if r[k] != v}
        if "occupancy_id" in changed:
            source = self.context.permissions.occupancy(r["occupancy_id"], True)
            target = self.context.permissions.occupancy(changed["occupancy_id"], True)
            if source["building_id"] != target["building_id"]:
                fail(403, "只能更正至同大樓入住。")
            enc, hashed = self.new_pickup_code(
                source["building_id"], r["pickup_code_hash"]
            )
            changed.update(pickup_code_encrypted=enc, pickup_code_hash=hashed)
        if changed:
            self.context.pickups.cancel_waiting(pid)
            self.update("parcels", pid, dict(changed, updated_at=now()))
        return self.parcel_view(self.parcel(pid))

    def pickup_code(self, pid):
        self.context.permissions.role("resident")
        r = self.parcel(pid)
        if r["status"] != "pending":
            fail(409, "此包裹目前不能領取。")
        return dict(
            parcel_id=pid, pickup_code=codes.decrypt(r["pickup_code_encrypted"])
        )
