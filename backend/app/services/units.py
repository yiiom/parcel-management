"""戶別建立、查詢與修改。"""

from app.services.common import now
from app.services.base import BaseService


class UnitService(BaseService):
    def unit_view(self, row):
        return dict(row, label=self.label(row))

    def units(self, bid, page, size, floor):
        self.context.permissions.building(bid)
        rows = self.all(
            "SELECT * FROM units WHERE building_id=%s ORDER BY id DESC", (bid,)
        )
        return self.page(
            [self.unit_view(r) for r in rows if floor is None or r["floor"] == floor],
            page,
            size,
        )

    def create_unit(self, bid, data):
        self.context.permissions.building(bid)
        uid = self.execute(
            "INSERT INTO units (building_id,floor,unit_number,created_at,updated_at) VALUES (%s,%s,%s,%s,%s)",
            (bid, data.floor, data.unit_number, now(), now()),
        )
        return self.unit_view(self.context.permissions.unit(uid))

    def update_unit(self, uid, data):
        self.context.permissions.unit(uid)
        self.update(
            "units", uid, dict(data.model_dump(exclude_unset=True), updated_at=now())
        )
        return self.unit_view(self.context.permissions.unit(uid))
