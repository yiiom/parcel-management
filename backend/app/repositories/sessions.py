from app.database import get_connection  # 匯入資料庫連線函式


# 保存登入紀錄；hashed_token 必須是憑證的雜湊，不是原始憑證
def create_session(user_id, hashed_token):
    with get_connection() as connection:  # 建立資料庫連線
        with connection.cursor() as cursor:  # 建立執行 SQL 的工具
            try:
                cursor.execute(
                    """
                    INSERT INTO auth_sessions (
                        token_hash, user_id, created_at, expires_at
                    )
                    VALUES (
                        %s, %s,
                        UTC_TIMESTAMP(6),
                        DATE_ADD(UTC_TIMESTAMP(6), INTERVAL 8 HOUR)
                    )
                    """,
                    (hashed_token, user_id),  # 依序代入憑證雜湊與帳號編號
                )

                connection.commit()  # 正式儲存登入紀錄
            except Exception:
                connection.rollback()  # 發生錯誤時撤銷未提交的變更
                raise  # 將錯誤交給上層程式處理

# 根據憑證雜湊，查找目前仍可使用的登入帳號
def get_active_session_user(hashed_token):
    with get_connection() as connection:
        with connection.cursor(dictionary=True) as cursor:
            cursor.execute(
                """
                SELECT u.id, u.name, u.email, u.phone,
                       u.role, u.is_active, u.created_at, u.updated_at
                FROM auth_sessions AS s
                INNER JOIN users AS u ON u.id = s.user_id
                WHERE s.token_hash = %s
                  AND s.revoked_at IS NULL
                  AND s.expires_at > UTC_TIMESTAMP(6)
                  AND u.is_active = TRUE
                """,
                (hashed_token,),  # 用收到的登入憑證雜湊查詢
            )

            return cursor.fetchone()  # 有效就回傳帳號，無效則回傳 None

# 撤銷指定憑證對應的登入，不影響其他裝置的登入紀錄
def revoke_session(hashed_token):
    with get_connection() as connection:
        with connection.cursor() as cursor:
            try:
                cursor.execute(
                    """
                    UPDATE auth_sessions
                    SET revoked_at = UTC_TIMESTAMP(6)
                    WHERE token_hash = %s
                      AND revoked_at IS NULL
                    """,
                    (hashed_token,),  # 只更新這次登入的憑證
                )

                connection.commit()  # 正式保存撤銷時間
            except Exception:
                connection.rollback()  # 發生錯誤時撤銷未提交的變更
                raise