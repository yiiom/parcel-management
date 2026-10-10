"""版本化 SQL；MySQL DDL 非交易性，失敗時保留 applying 標記並停止。"""

import hashlib
from pathlib import Path

from app.database import get_connection


def migrate():
    with get_connection() as db:
        cursor = db.cursor(dictionary=True)
        cursor.execute("SELECT GET_LOCK('parcel_schema_migrations', 30) AS acquired")
        if cursor.fetchone()["acquired"] != 1:
            raise RuntimeError("無法取得資料庫升級鎖。")
        try:
            cursor.execute("""CREATE TABLE IF NOT EXISTS schema_migrations (
                version VARCHAR(100) PRIMARY KEY,
                checksum CHAR(64) NOT NULL,
                status VARCHAR(20) NOT NULL,
                applied_at DATETIME(6) NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""")
            for path in sorted(Path(__file__).with_name("migrations").glob("*.sql")):
                sql = path.read_text(encoding="utf-8")
                checksum = hashlib.sha256(sql.encode()).hexdigest()
                cursor.execute("SELECT * FROM schema_migrations WHERE version=%s", (path.name,))
                row = cursor.fetchone()
                if row:
                    if row["checksum"] != checksum or row["status"] != "applied":
                        raise RuntimeError(f"升級 {path.name} 不完整或來源已變動，請先人工核對；不會自動覆寫。")
                    continue
                cursor.execute("INSERT INTO schema_migrations (version,checksum,status) VALUES (%s,%s,'applying')", (path.name, checksum))
                db.commit()
                # 每個版本只包含一個 DDL，避免以分號切割 SQL 字串。
                cursor.execute(sql)
                cursor.execute("UPDATE schema_migrations SET status='applied',applied_at=UTC_TIMESTAMP(6) WHERE version=%s", (path.name,))
                db.commit()
                print(f"已套用 {path.name}")
        finally:
            cursor.execute("SELECT RELEASE_LOCK('parcel_schema_migrations')")
            cursor.fetchone()
            cursor.close()


if __name__ == "__main__":
    migrate()
