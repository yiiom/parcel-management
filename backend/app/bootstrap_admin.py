"""建立首位系統管理員。密碼透過隱藏輸入取得，不寫入參數或日誌。"""
from getpass import getpass
from app.database import get_connection
from app.core.security import hasher
from app.schemas.accounts import RegisterRequest


def bootstrap(data: RegisterRequest):
    with get_connection() as db:
        with db.cursor(dictionary=True) as cursor:
            cursor.execute("SELECT GET_LOCK('parcel_first_admin', 10) AS acquired")
            if cursor.fetchone()["acquired"] != 1:
                raise RuntimeError("無法取得初始化鎖，請稍後再試。")
            try:
                cursor.execute("SELECT id, email FROM users WHERE role='system_admin' LIMIT 1")
                existing = cursor.fetchone()
                if existing:
                    if existing["email"] == str(data.email):
                        return False  # 重跑不覆寫姓名、密碼或啟用狀態
                    raise ValueError("系統管理員已存在，不再建立首位管理員。")
                cursor.execute("SELECT id FROM users WHERE email=%s", (str(data.email),))
                if cursor.fetchone():
                    raise ValueError("此 Email 已被使用，不能將既有帳號升級為管理員。")
                cursor.execute(
                    """INSERT INTO users (name,email,phone,password_hash,role,is_active,created_at,updated_at)
                    VALUES (%s,%s,%s,%s,'system_admin',TRUE,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))""",
                    (data.name, str(data.email), data.phone, hasher.hash(data.password)),
                )
                db.commit()
                return True
            except Exception:
                db.rollback()
                raise
            finally:
                cursor.execute("SELECT RELEASE_LOCK('parcel_first_admin')")
                cursor.fetchone()


if __name__ == "__main__":
    try:
        name = input("姓名：")
        email = input("Email：")
        phone = input("聯絡電話：")
        password = getpass("密碼（8～128 字元）：")
        if password != getpass("再次輸入密碼："):
            raise ValueError("兩次密碼不一致。")
        data = RegisterRequest(name=name, email=email, phone=phone, password=password)
        created = bootstrap(data)
        print("系統管理員已建立。" if created else "管理員已存在，未變更資料。")
    except Exception:
        # 驗證例外可能包含輸入，不直接輸出以免洩漏密碼。
        print("初始化未完成：請確認輸入格式、Email 未被使用，且尚無其他系統管理員。")
        raise SystemExit(1) from None
