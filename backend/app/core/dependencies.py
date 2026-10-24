from fastapi import Request  # 用來讀取這次請求的 Cookie

from app.core.errors import APIError
from app.core.security import token_hash  # 將原始憑證轉成雜湊
from app.repositories.sessions import get_active_session_user
from app.schemas.accounts import User  # 對外使用的帳號資料格式


# 取得這次請求所屬的登入帳號；驗證失敗就中止請求
def get_current_user(request: Request) -> User:
    raw_token = request.cookies.get("access_token")  # 讀取瀏覽器送來的登入憑證

    if not raw_token:  # 沒有登入 Cookie
        raise APIError(
            status=401,
            code="UNAUTHENTICATED",
            message="請先登入。",
        )

    hashed_token = token_hash(raw_token)  # 用相同方式計算雜湊
    user = get_active_session_user(hashed_token)  # 查詢目前仍有效的登入

    if user is None:  # 憑證無效、到期、已撤銷，或帳號停用
        raise APIError(
            status=401,
            code="UNAUTHENTICATED",
            message="登入已失效，請重新登入。",
        )

    return User.model_validate(user)  # 將帳號資料轉成 User 格式