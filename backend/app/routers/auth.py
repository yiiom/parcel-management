from fastapi import APIRouter, Request, Response  # Request 讀取 Cookie，Response 設定回應

from app.schemas.accounts import RegisterRequest, LoginRequest, User, Error
from app.services.auth import register_resident, login_user, logout_user
from app.core.settings import secure_cookie
from app.core.rate_limits import check_auth_rate

router = APIRouter(
    prefix="/api/auth",  # 這組 API 共用的網址前綴
    tags=["帳號與登入"],  # 在 Swagger 文件中的分類名稱
)


@router.post(
    "/register",  # 完整網址為 POST /api/auth/register
    response_model=User,  # 回傳資料須符合 User 格式，排除未定義欄位
    status_code=201,  # 201 表示成功建立資料
    operation_id="register_resident",  # 對應 API 規格中的操作名稱
    responses={
        403: {"model": Error, "description": "請求來源不被允許。"},
        429: {"model": Error, "description": "嘗試次數過多。"},
        409: {"model": Error, "description": "Email 已註冊。"},
        422: {"model": Error, "description": "輸入資料格式不正確。"},
        500: {"model": Error, "description": "系統暫時無法完成操作。"},
    },  # 告訴 Swagger 各種錯誤回應的格式
)
def register(data: RegisterRequest, request: Request):  # FastAPI 會先檢查收到的 JSON
    check_auth_rate(request, "register", str(data.email))
    return register_resident(data)  # 呼叫註冊服務，回傳建立的帳號

@router.post(
    "/login",  # 完整網址為 POST /api/auth/login
    response_model=User,  # JSON 只回傳帳號資料
    operation_id="login",
    responses={
        403: {"model": Error, "description": "請求來源不被允許。"},
        429: {"model": Error, "description": "嘗試次數過多。"},
        401: {"model": Error, "description": "帳號密碼錯誤或帳號無法使用。"},
        422: {"model": Error, "description": "輸入資料格式不正確。"},
        500: {"model": Error, "description": "系統暫時無法完成操作。"},
    },
)
def login(data: LoginRequest, response: Response, request: Request):
    check_auth_rate(request, "login", str(data.email))
    user, raw_token = login_user(data)  # 驗證帳密並建立登入紀錄

    response.set_cookie(
        key="access_token",  # Cookie 的名稱
        value=raw_token,  # 原始登入憑證交給瀏覽器保存
        httponly=True,  # 不允許網頁 JavaScript 直接讀取這個 Cookie
        secure=secure_cookie(),
        samesite="lax",  # 限制部分跨網站請求攜帶 Cookie
        max_age=8 * 60 * 60,  # 瀏覽器保存期限為 8 小時，單位是秒
        path="/",  # Cookie 適用的網址路徑
    )

    response.headers["Cache-Control"] = "no-store"  # 要求不要快取登入回應
    return user  # JSON 不包含原始憑證或密碼雜湊

@router.post(
    "/logout",
    status_code=204,  # 204 表示成功，但沒有回應內容
    response_class=Response,
    operation_id="logout",
    responses={
        403: {"model": Error, "description": "請求來源不被允許。"},
        500: {"model": Error, "description": "系統暫時無法完成操作。"},
    },
)
def logout(request: Request):
    raw_token = request.cookies.get("access_token")  # 取得目前登入憑證
    logout_user(raw_token)  # 先撤銷資料庫中的登入紀錄

    response = Response(status_code=204)  # 建立沒有內容的成功回應
    response.delete_cookie(
        key="access_token",
        path="/",  # 與登入時設定的路徑一致
        httponly=True,
        secure=secure_cookie(),
        samesite="lax",
    )  # 通知瀏覽器清除登入 Cookie

    response.headers["Cache-Control"] = "no-store"
    return response
