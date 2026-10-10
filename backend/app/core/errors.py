from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException


class APIError(Exception):
    def __init__(self, status: int, code: str, message: str, headers=None):
        self.status, self.code, self.message, self.headers = status, code, message, headers


def install_error_handlers(app):
    @app.exception_handler(APIError)
    async def api_error(request: Request, exc: APIError):
        return JSONResponse(status_code=exc.status, content={"code": exc.code, "message": exc.message}, headers=exc.headers)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        # 不回傳 Pydantic 的 input，避免錯誤回應洩漏密碼。
        details = [{"field": ".".join(map(str, e["loc"][1:])), "message": "欄位缺漏、格式錯誤或不允許修改。"} for e in exc.errors()]
        return JSONResponse(status_code=422, content={"code": "VALIDATION_ERROR", "message": "輸入資料格式不正確。", "details": details})

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"code": "HTTP_ERROR", "message": str(exc.detail)}, headers=exc.headers)

    @app.exception_handler(Exception)
    async def internal_error(request: Request, exc: Exception):
        return JSONResponse(status_code=500, content={"code": "INTERNAL_ERROR", "message": "系統暫時無法完成操作。"})
