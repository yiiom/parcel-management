"""跨程序共用的固定時間窗限流；使用資料列鎖避免並行繞過。"""
import math
from datetime import datetime, timezone
from app.database import get_connection


def consume(bucket_hash, limit, seconds):
    with get_connection() as db:
        with db.cursor(dictionary=True) as cursor:
            try:
                now = datetime.now(timezone.utc).replace(tzinfo=None)
                cursor.execute(
                    "INSERT INTO auth_rate_limits (bucket_hash, window_start, attempts) VALUES (%s,%s,1) ON DUPLICATE KEY UPDATE bucket_hash=VALUES(bucket_hash)",
                    (bucket_hash, now),
                )
                inserted = cursor.rowcount == 1
                cursor.execute("SELECT window_start, attempts FROM auth_rate_limits WHERE bucket_hash=%s FOR UPDATE", (bucket_hash,))
                row = cursor.fetchone()
                age = (now - row["window_start"]).total_seconds()
                if age >= seconds:
                    cursor.execute("UPDATE auth_rate_limits SET window_start=%s, attempts=1 WHERE bucket_hash=%s", (now, bucket_hash))
                elif not inserted:
                    if row["attempts"] >= limit:
                        db.commit()
                        return max(1, math.ceil(seconds - age))
                    cursor.execute("UPDATE auth_rate_limits SET attempts=attempts+1 WHERE bucket_hash=%s", (bucket_hash,))
                db.commit()
                return 0
            except Exception:
                db.rollback()
                raise
