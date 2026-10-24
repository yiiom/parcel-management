from fastapi import Request
from app.core.errors import APIError
from app.core.security import token_hash
from app.repositories.rate_limits import consume


def check_auth_rate(request: Request, action: str, email: str):
    # 不信任客戶端傳入的 X-Forwarded-For，避免自行更換來源繞過限流。
    ip = request.client.host if request.client else "unknown"
    limit, seconds = (20, 300) if action == "login" else (10, 3600)
    for scope, identity in (("ip", ip), ("email", email)):
        retry = consume(token_hash(f"{action}:{scope}:{identity}"), limit, seconds)
        if retry:
            raise APIError(429, "TOO_MANY_REQUESTS", "嘗試次數過多，請稍後再試。", {"Retry-After": str(retry)})
