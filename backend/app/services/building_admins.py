"""管理員帳號、分配與名單。"""

from app.core.security import hasher
from app.services.common import now
from app.services.common import fail
from app.services.base import BaseService


class BuildingAdminService(BaseService):
    def admin_view(self, row):
        u = self.one("SELECT * FROM users WHERE id=%s", (row["user_id"],), True)
        public = {k: v for k, v in u.items() if k != "password_hash"}
        public["is_active"] = bool(public["is_active"])
        return dict(
            id=row["id"],
            building_id=row["building_id"],
            created_at=row["created_at"],
            user=public,
        )

    def assign(self, bid, data):
        self.context.permissions.role("system_admin")
        self.context.permissions.building(bid, True)
        if hasattr(data, "user_id"):
            uid = data.user_id
            target = self.one(
                "SELECT * FROM users WHERE id=%s FOR UPDATE", (uid,), True
            )
            if target["role"] != "building_admin" or not target["is_active"]:
                fail(409, "只能分配啟用的大樓管理員。")
        else:
            uid = self.execute(
                "INSERT INTO users (name,email,phone,password_hash,role,is_active,created_at,updated_at) VALUES (%s,%s,%s,%s,'building_admin',TRUE,%s,%s)",
                (
                    data.name,
                    str(data.email),
                    data.phone,
                    hasher.hash(data.password),
                    now(),
                    now(),
                ),
            )
        if self.one("SELECT id FROM building_admins WHERE user_id=%s", (uid,)):
            fail(409, "請先解除管理員的原分配。")
        aid = self.execute(
            "INSERT INTO building_admins (user_id,building_id,created_at) VALUES (%s,%s,%s)",
            (uid, bid, now()),
        )
        return self.admin_view(
            self.one("SELECT * FROM building_admins WHERE id=%s", (aid,))
        )

    def unassign(self, bid, uid):
        self.context.permissions.role("system_admin")
        self.context.permissions.building(bid, True)
        self.execute(
            "DELETE FROM building_admins WHERE building_id=%s AND user_id=%s",
            (bid, uid),
        )

    def admins(self, bid, page, size):
        self.context.permissions.role("system_admin")
        self.context.permissions.building(bid, True)
        return self.page(
            [
                self.admin_view(r)
                for r in self.all(
                    "SELECT * FROM building_admins WHERE building_id=%s ORDER BY id DESC",
                    (bid,),
                )
            ],
            page,
            size,
        )

    def directory(self, page, size):
        self.context.permissions.role("system_admin")
        return self.page(
            self.all(
                "SELECT u.id user_id,u.name,a.building_id,b.name building_name FROM users u LEFT JOIN building_admins a ON a.user_id=u.id LEFT JOIN buildings b ON b.id=a.building_id WHERE u.role='building_admin' ORDER BY u.id DESC"
            ),
            page,
            size,
        )
