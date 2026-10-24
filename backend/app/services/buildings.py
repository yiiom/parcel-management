"""大樓建立、查詢與修改。"""

from mysql.connector import IntegrityError
from app.services.common import now, fail
from app.services.base import BaseService


class BuildingService(BaseService):
    def list_buildings(self, page, size, keyword):
        self.context.permissions.role("system_admin", "building_admin")
        rows = self.all("SELECT * FROM buildings ORDER BY id DESC")
        if self.user["role"] == "building_admin":
            assigned = self.one(
                "SELECT building_id FROM building_admins WHERE user_id=%s",
                (self.user["id"],),
            )
            rows = [r for r in rows if assigned and r["id"] == assigned["building_id"]]
        if keyword:
            rows = [r for r in rows if keyword.casefold() in r["name"].casefold()]
        result = self.page(rows, page, size)
        result["items"] = [dict(row, can_delete=self.can_delete(row["id"])) for row in result["items"]]
        return result

    def create_building(self, data):
        self.context.permissions.role("system_admin")
        bid = self.execute(
            "INSERT INTO buildings (name,address,phone,created_at,updated_at) VALUES (%s,%s,%s,%s,%s)",
            (data.name, data.address, data.phone, now(), now()),
        )
        return self.get_building(bid)

    def update_building(self, bid, data):
        self.context.permissions.building(bid, True)
        self.update(
            "buildings",
            bid,
            dict(data.model_dump(exclude_unset=True), updated_at=now()),
        )
        return self.get_building(bid)

    def can_delete(self, bid):
        if self.user["role"] != "system_admin":
            return False
        # 與真正刪除共用同一組關聯條件；入住及簽收等紀錄受戶別／包裹外鍵鏈保護。
        row = self.one(
            "SELECT (EXISTS(SELECT 1 FROM building_admins WHERE building_id=%s) "
            "OR EXISTS(SELECT 1 FROM units WHERE building_id=%s) "
            "OR EXISTS(SELECT 1 FROM parcels WHERE code_building_id=%s)) AS blocked",
            (bid, bid, bid),
        )
        return not bool(row["blocked"])

    def get_building(self, bid):
        row = self.context.permissions.building(bid, True)
        return dict(row, can_delete=self.can_delete(bid))

    def delete_building(self, bid):
        self.context.permissions.role("system_admin")
        self.context.permissions.building(bid, True)
        # 不能信任畫面先前的 can_delete；交易鎖內再次檢查，外鍵仍保留。
        if not self.can_delete(bid):
            fail(409, "此大樓已有管理員分配、戶別或業務紀錄，不能刪除。")
        try:
            self.execute("DELETE FROM buildings WHERE id=%s", (bid,))
        except IntegrityError as exc:
            if exc.errno == 1451:
                fail(409, "此大樓已有關聯資料，不能刪除。")
            raise
