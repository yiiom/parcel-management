"""規則一致的業務交易。

MVP 以資料庫命名鎖序列化業務操作，所有權限重查、狀態變化與回應讀取同交易。
鎖依資料庫分隔；唯一鍵與外鍵另防資料不變量失效。擴充吞吐量時再細分鎖範圍。"""

import os
from contextlib import contextmanager
from mysql.connector import IntegrityError
from app.database import get_connection
from app.core.errors import APIError
from app.services.common import fail
from app.services.context import ServiceContext


@contextmanager
def transaction(user):
    with get_connection() as db:
        c = db.cursor(dictionary=True, buffered=True)
        lock = "parcel-domain:" + os.environ["DB_NAME"]
        acquired = False
        try:
            c.execute("SELECT GET_LOCK(%s, 10) AS ok", (lock,))
            acquired = c.fetchone()["ok"] == 1
            if not acquired:
                fail(409, "系統忙碌，請稍後重試。")
            c.execute("SELECT * FROM users WHERE id=%s FOR UPDATE", (user.id,))
            current = c.fetchone()
            if not current or not current["is_active"]:
                raise APIError(401, "UNAUTHENTICATED", "登入已失效，請重新登入。")
            yield ServiceContext(db, c, current)
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            if exc.errno == 1062:
                fail(409, "資料重複或已有有效紀錄。")
            raise
        except Exception:
            db.rollback()
            raise
        finally:
            if acquired:
                c.execute("SELECT RELEASE_LOCK(%s)", (lock,))
                c.fetchone()
            c.close()
