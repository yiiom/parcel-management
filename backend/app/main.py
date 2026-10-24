"""後端啟動入口：39 個業務 API、統一錯誤、來源檢查與資料庫健康檢查。"""

import os
import json
from pathlib import Path

import mysql.connector
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.database import get_connection
from app.core.errors import install_error_handlers  # 匯入統一錯誤處理設定
from app.core.request_security import RequestSecurityMiddleware
from app.routers.auth import router as auth_router  # 匯入帳號路由，取別名方便辨識
from app.routers.users import router as users_router  # 匯入個人帳號 API
from app.routers.domain import router as domain_router

app = FastAPI(title="大樓包裹管理系統")
install_error_handlers(app)  # 讓輸入錯誤、Email 重複等情況回傳統一的 JSON 格式
app.include_router(auth_router)  # 將註冊 API 加入主程式，讓它可以被呼叫
app.include_router(users_router)  # 啟用 GET /api/users/me
app.include_router(domain_router)
# 實際 Swagger 沿用契約的中文用途；路由與輸入／回應模型仍由 FastAPI 真實產生。
contract_operations = json.loads(
    Path(__file__).with_name("contract_operations.json").read_text(encoding="utf-8")
)
for route in app.routes:
    for method in getattr(route, "methods", []):
        description = contract_operations.get(route.path, {}).get(method.lower())
        if description:
            route.summary = description["summary"]
            route.description = description["description"]
            route.tags = description["tags"]
app.add_middleware(RequestSecurityMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.environ.get("CORS_ORIGINS", "http://localhost:3001").split(",")
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    # 讓跨來源前端讀取驗碼暫停秒數，不改變既有來源與權限限制。
    expose_headers=["Retry-After"],
)


@app.get("/health", tags=["環境檢查"])
def health():
    connection = None
    try:
        connection = get_connection()
        cursor = connection.cursor()
        try:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        finally:
            cursor.close()
    except mysql.connector.Error:
        raise HTTPException(status_code=503, detail="資料庫暫時無法連線。") from None
    finally:
        if connection is not None:
            connection.close()
    return {"status": "ok", "database": "connected"}
