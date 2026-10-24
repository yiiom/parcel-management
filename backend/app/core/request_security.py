"""Cookie 驗證的寫入請求必須來自明確允許的來源。"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from app.core.settings import origins


class RequestSecurityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        if request.url.path.startswith("/api/") and request.method in {"POST", "PATCH", "PUT", "DELETE"}:
            origin = request.headers.get("origin")
            if origin not in origins():
                return JSONResponse(
                    status_code=403,
                    content={"code": "FORBIDDEN", "message": "請求來源不被允許，請從系統頁面操作。"},
                    headers={"Cache-Control": "no-store"},
                )
        response = await call_next(request)
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response
