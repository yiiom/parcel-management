"""角色、大樓與入住資料存取權限。"""

from app.services.common import fail
from app.services.base import BaseService


class PermissionService(BaseService):
    def role(self, *roles):
        if self.user["role"] not in roles:
            fail(403, "你沒有權限執行此操作。")

    def building(self, bid, system=False):
        if system:
            self.role("system_admin", "building_admin")
        else:
            self.role("building_admin")
        if self.user["role"] != "system_admin" and not self.one(
            "SELECT id FROM building_admins WHERE user_id=%s AND building_id=%s",
            (self.user["id"], bid),
        ):
            fail(403, "你沒有此大樓的管理權。")
        return self.one("SELECT * FROM buildings WHERE id=%s", (bid,), True)

    def occupancy(self, oid, active=False):
        row = self.one(
            "SELECT o.*,u.building_id,u.floor,u.unit_number FROM occupancies o JOIN units u ON u.id=o.unit_id WHERE o.id=%s",
            (oid,),
            True,
        )
        if active and row["ended_at"] is not None:
            fail(409, "入住已結束。")
        return row

    def unit(self, uid):
        row = self.one("SELECT * FROM units WHERE id=%s", (uid,), True)
        self.building(row["building_id"])
        return row

    def membership_access(self, oid):
        self.role("resident")
        row = self.one(
            "SELECT m.id FROM unit_memberships m JOIN occupancies o ON o.id=m.occupancy_id WHERE m.user_id=%s AND m.occupancy_id=%s AND m.status IN ('active','exit_requested') AND o.ended_at IS NULL",
            (self.user["id"], oid),
        )
        if not row:
            fail(403, "你沒有此入住的存取權。")
