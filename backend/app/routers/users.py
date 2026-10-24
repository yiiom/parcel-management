from fastapi import APIRouter, Depends, Response

from app.core.dependencies import get_current_user  # 共用登入檢查
from app.schemas.accounts import User, Me, Error, ProfileUpdate
from app.services.users import update_my_profile  # 修改個人資料的服務
from app.services.transactions import transaction

router = APIRouter(
    prefix="/api/users",  # 這組 API 的網址前綴
    tags=["帳號與登入"],
)


@router.get(
    "/me",  # 完整網址為 GET /api/users/me
    response_model=Me,
    operation_id="get_me",
    responses={
        401: {"model": Error, "description": "尚未登入或登入已失效。"},
        500: {"model": Error, "description": "系統暫時無法完成操作。"},
    },
)
def get_me(
    response: Response,
    user: User = Depends(get_current_user),  # 先檢查登入，成功才執行下方內容
):
    response.headers["Cache-Control"] = "no-store"  # 不快取個人資料

    with transaction(user) as service:
        return Me(user=User.model_validate(service.user), **service.memberships.me())

@router.patch(
    "/me",  # 完整網址為 PATCH /api/users/me
    response_model=User,  # 成功回傳更新後的帳號資料
    status_code=200,
    operation_id="update_me",  # 與文件的操作名稱一致
    responses={
        401: {"model": Error, "description": "尚未登入或登入已失效。"},
        403: {"model": Error, "description": "禁止此操作。"},
        422: {"model": Error, "description": "輸入資料格式不正確。"},
        500: {"model": Error, "description": "系統暫時無法完成操作。"},
    },
)
def update_me(
    data: ProfileUpdate,  # 驗證姓名、電話，拒絕空物件及其他欄位
    response: Response,
    user: User = Depends(get_current_user),  # 從有效 Cookie 取得本人身分
):
    response.headers["Cache-Control"] = "no-store"  # 不快取個人資料

    return update_my_profile(
        current_user=user,
        data=data,
    )
