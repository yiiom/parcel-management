"""安全設定由部署環境提供；本機預設只信任 localhost。"""
import os


def origins():
    values = os.getenv("CORS_ORIGINS", "http://localhost:3001,http://127.0.0.1:3001")
    values += "," + os.getenv("API_ORIGINS", "http://localhost:8001,http://127.0.0.1:8001")
    return {value.strip().rstrip("/") for value in values.split(",") if value.strip()}


def secure_cookie():
    # 正式環境預設啟用；本機 Compose 明確設定 false。
    return os.getenv("COOKIE_SECURE", "true").lower() == "true"
