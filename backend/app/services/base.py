"""共用 SQL、分頁與顯示工具。"""

from app.services.common import fail


class BaseService:
    def __init__(self, context):
        self.context = context
        self.db, self.c, self.user = context.db, context.c, context.user

    def execute(self, sql, values=()):
        self.c.execute(sql, values)
        return self.c.lastrowid

    def one(self, sql, values=(), required=False):
        self.execute(sql, values)
        row = self.c.fetchone()
        if required and not row:
            fail(404, "找不到資料。")
        return row

    def all(self, sql, values=()):
        self.execute(sql, values)
        return self.c.fetchall()

    @staticmethod
    def label(row):
        return row["floor"] + "／" + row["unit_number"]

    @staticmethod
    def page(items, page, page_size):
        return dict(
            items=items[(page - 1) * page_size : page * page_size],
            total=len(items),
            page=page,
            page_size=page_size,
        )

    def update(self, table, ident, values):
        # table 與欄位只由內部固定常數、Pydantic 白名單提供。
        if values:
            self.execute(
                f"UPDATE {table} SET "
                + ",".join(k + "=%s" for k in values)
                + " WHERE id=%s",
                (*values.values(), ident),
            )
