from app.database import get_connection  # 匯入專案已寫好的資料庫連線函式


# 定義新增住戶的函式，接收姓名、Email、電話與已雜湊的密碼
def create_resident(name, email, phone, password_hash):
    with get_connection() as connection:  # 建立資料庫連線，離開區塊時自動關閉
        with connection.cursor(dictionary=True) as cursor:  # 建立執行 SQL 的工具，查詢結果使用字典格式
            try:  # 嘗試執行以下操作；發生錯誤時會跳到 except
                # 新增帳號：角色固定為住戶，帳號預設啟用，時間使用 UTC
                # %s 是預留位置，實際資料由下方的 tuple 依順序代入
                cursor.execute(
                    """
                    INSERT INTO users (
                        name, email, phone, password_hash,
                        role, is_active, created_at, updated_at
                    )
                    VALUES (
                        %s, %s, %s, %s,
                        'resident', TRUE, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)
                    )
                    """,
                    (name, email, phone, password_hash),  # 對應上面四個 %s
                )

                user_id = cursor.lastrowid  # 取得剛新增帳號的自動編號 id

                # 查詢剛新增的帳號，只取可回傳的欄位，不包含密碼雜湊
                cursor.execute(
                    """
                    SELECT id, name, email, phone, role,
                           is_active, created_at, updated_at
                    FROM users
                    WHERE id = %s
                    """,
                    (user_id,),  # 傳入帳號編號；單一元素的 tuple 也需要逗號
                )
                user = cursor.fetchone()  # 取出一筆結果，例如 {"id": 1, "name": "小明", ...}

                connection.commit()  # 提交交易，正式儲存新增的帳號
                return user  # 把帳號資料交回呼叫這個函式的程式
            except Exception:  # 如果上述操作發生錯誤
                connection.rollback()  # 撤銷這次交易尚未提交的變更
                raise  # 將錯誤繼續往外傳，讓上層程式決定如何回應

# 根據 Email 查找帳號，供登入服務核對密碼與帳號狀態
def get_user_by_email(email):
    with get_connection() as connection:  # 建立資料庫連線
        with connection.cursor(dictionary=True) as cursor:  # 查詢結果使用字典格式
            cursor.execute(
                """
                SELECT id, name, email, phone, password_hash,
                       role, is_active, created_at, updated_at
                FROM users
                WHERE email = %s
                """,
                (email,),  # 將 Email 安全地代入 SQL
            )

            return cursor.fetchone()  # 找到回傳帳號資料；找不到回傳 None

# user_id 必須由後端的登入檢查取得，不能採用前端指定的帳號
def update_user_profile(user_id, name=None, phone=None):
    with get_connection() as connection:
        with connection.cursor(dictionary=True) as cursor:
            try:
                # COALESCE：未提供的欄位保留原值
                # 傳入資料的格式與長度，會先由 ProfileUpdate 驗證
                cursor.execute(
                    """
                    UPDATE users
                    SET name = COALESCE(%s, name),
                        phone = COALESCE(%s, phone),
                        updated_at = UTC_TIMESTAMP(6)
                    WHERE id = %s
                      AND is_active = TRUE
                    """,
                    (name, phone, user_id),
                )

                # 只查詢這個帳號，並且不取出密碼雜湊
                cursor.execute(
                    """
                    SELECT id, name, email, phone, role,
                           is_active, created_at, updated_at
                    FROM users
                    WHERE id = %s
                      AND is_active = TRUE
                    """,
                    (user_id,),
                )
                user = cursor.fetchone()

                connection.commit()  # 正式保存修改
                return user  # 不存在或已停用時回傳 None
            except Exception:
                connection.rollback()  # 失敗時撤銷本次修改
                raise