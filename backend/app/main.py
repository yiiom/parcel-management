"""開發環境入口；目前僅提供服務與資料庫連線檢查。"""

import os

import mysql.connector
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.database import get_connection

app = FastAPI(title="大樓包裹管理系統")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "http://localhost:3001").split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
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
