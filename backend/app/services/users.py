from app.core.errors import APIError
from app.repositories.users import update_user_profile
from app.schemas.accounts import ProfileUpdate, User


# current_user 由後端登入檢查取得；data 是已通過驗證的修改內容
def update_my_profile(current_user: User, data: ProfileUpdate) -> User:
    user = update_user_profile(
        user_id=current_user.id,  # 只更新目前登入者
        name=data.name,  # 未提供時為 None，資料庫保留原值
        phone=data.phone,
    )

    # 帳號可能在登入檢查後、更新前被停用
    if user is None:
        raise APIError(
            status=401,
            code="UNAUTHENTICATED",
            message="登入已失效，請重新登入。",
        )

    return User.model_validate(user)  # 使用統一的帳號回應格式