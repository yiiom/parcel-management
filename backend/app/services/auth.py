import secrets  # 產生難以猜測的隨機登入憑證

from mysql.connector import IntegrityError

from app.core.errors import APIError
from app.core.security import (
    hasher,  # 註冊時使用的密碼雜湊工具
    DUMMY_HASH,  # 帳號不存在時，也執行一次密碼驗證運算
    verify_password,  # 核對輸入的密碼
    token_hash,  # 將登入憑證轉成雜湊
)
from app.repositories.users import create_resident, get_user_by_email
from app.repositories.sessions import create_session, revoke_session
from app.schemas.accounts import RegisterRequest, LoginRequest, User


# data 是已通過 RegisterRequest 格式檢查的註冊資料
def register_resident(data: RegisterRequest):
    password_hash = hasher.hash(data.password)  # 將原始密碼轉成雜湊

    try:
        return create_resident(  # 新增帳號，成功後回傳帳號資料
            name=data.name,
            email=str(data.email),
            phone=data.phone,
            password_hash=password_hash,  # 只將雜湊交給資料庫函式
        )
    except IntegrityError as error:  # 捕捉資料庫限制相關的錯誤
        if error.errno == 1062:  # MySQL 的 1062 代表唯一值重複
            raise APIError(
                status=409,  # HTTP 409 表示資料衝突
                code="CONFLICT",  # 供前端辨識的錯誤代碼
                message="此 Email 已註冊。",  # 給使用者看的提示
            ) from None  # 不串接顯示原始資料庫例外

        raise  # 其他資料庫限制錯誤繼續往外傳，不誤報為 Email 重複

# 接收已通過格式檢查的登入資料
def login_user(data: LoginRequest):
    user = get_user_by_email(str(data.email))  # 根據 Email 查找帳號

    # 找不到帳號時仍執行雜湊驗證，減少處理時間差異
    saved_hash = user["password_hash"] if user else DUMMY_HASH
    password_valid = verify_password(saved_hash, data.password)

    # 帳號不存在、密碼錯誤或帳號停用，都不允許登入
    if user is None or not password_valid or not user["is_active"]:
        raise APIError(
            status=401,
            code="UNAUTHENTICATED",
            message="帳號或密碼不正確，或帳號無法使用。",
        )

    # 轉成對外的帳號格式，排除 password_hash
    public_user = User.model_validate(user)

    raw_token = secrets.token_urlsafe(32)  # 每次登入產生新的隨機憑證
    hashed_token = token_hash(raw_token)  # 計算憑證的雜湊

    create_session(user["id"], hashed_token)  # 資料庫只保存雜湊

    # 交給後端 API 入口處理；原始憑證稍後放入 Cookie，不放進 JSON
    return public_user, raw_token

# 沒有 Cookie 或重複登出，也允許正常結束
def logout_user(raw_token: str | None):
    if raw_token:
        revoke_session(token_hash(raw_token))  # 撤銷目前憑證對應的登入