"""業務服務共用時間與錯誤回應。"""

from datetime import datetime, timezone
from app.core.errors import APIError


def now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def fail(status=409, message="目前狀態不允許此操作。", code=None):
    raise APIError(
        status,
        code
        or {
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            409: "CONFLICT",
            410: "VERIFICATION_EXPIRED",
        }.get(status, "INVALID_CODE"),
        message,
    )
