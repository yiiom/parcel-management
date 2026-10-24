"""2A 真實 HTTP／MySQL 驗收，只允許專用測試資料庫，不刪除既有資料。
docker compose exec -T -e DB_NAME=parcel_management_test backend python -m app.acceptance_2a
"""
import json
import os
import secrets
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from app.database import get_connection
from app.migrate import migrate
from app.core.security import token_hash, hasher
from app.bootstrap_admin import bootstrap
from app.schemas.accounts import RegisterRequest
from app.repositories.rate_limits import consume
from app.test_support import wait_for_server


def sql(query, params=()):
    with get_connection() as db:
        with db.cursor(dictionary=True) as cursor:
            cursor.execute(query, params)
            rows = cursor.fetchall() if cursor.with_rows else []
            db.commit()
            return rows


def call(method, path, body=None, cookie=None, origin="http://localhost:3001"):
    headers = {"Content-Type": "application/json"}
    if origin is not None: headers["Origin"] = origin
    if cookie: headers["Cookie"] = cookie
    request = Request("http://127.0.0.1:18000" + path, data=json.dumps(body).encode() if body is not None else None, method=method, headers=headers)
    try:
        response = urlopen(request, timeout=10)
    except HTTPError as error:
        response = error
    with response:
        raw = response.read()
        return response.status, json.loads(raw) if raw else None, response.headers


def run():
    if os.getenv("DB_NAME") != "parcel_management_test":
        raise RuntimeError("只允許 parcel_management_test，拒絕在開發或正式資料庫執行。")
    migrate()
    migrate()
    # 過期測試庫的舊限流視窗，不動開發資料庫。
    sql("UPDATE auth_rate_limits SET window_start=DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 2 HOUR)")
    # 固定驗收子程序來源，不受另一組本機驗收連接埠影響。
    env = dict(os.environ, COOKIE_SECURE="false", CORS_ORIGINS="http://localhost:3001", API_ORIGINS="http://localhost:18000")
    process = subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "18000", "--no-access-log"], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    count = 0
    def check(condition, label):
        nonlocal count
        assert condition, label
        count += 1
        print("PASS", label, flush=True)
    try:
        wait_for_server(process, lambda: call("GET", "/health")[0] == 200)
        suffix = secrets.token_hex(6)
        email = f"accept-{suffix}@example.com"
        password = "Acceptance2026!"
        data = dict(name="住戶測試", email=email, phone="0912345678", password=password)
        check(call("POST", "/api/auth/register", data, origin="https://evil.example")[0] == 403, "foreign origin rejected")
        check(call("POST", "/api/auth/register", data, origin=None)[0] == 403, "missing origin rejected")
        status, user, _ = call("POST", "/api/auth/register", data)
        check(status == 201 and user["role"] == "resident" and "password_hash" not in user, f"register resident and safe response (HTTP {status})")
        uid = user["id"]
        check(call("POST", "/api/auth/register", data)[0] == 409, "duplicate email")
        check(call("POST", "/api/auth/register", dict(data, role="system_admin"))[0] == 422, "public role escalation rejected")
        check(call("POST", "/api/auth/register", dict(data, name="𠮷" * 101))[0] == 422, "registration name 101 rejected")
        check(call("POST", "/api/auth/register", dict(data, email=f"boundary-{suffix}@example.com", name="𠮷" * 100))[0] == 201, "registration Unicode name 100")
        check(call("POST", "/api/auth/login", dict(email=email, password="wrong-password"))[0] == 401, "wrong password")
        status, _, headers = call("POST", "/api/auth/login", dict(email=email, password=password))
        cookie = headers["Set-Cookie"].split(";")[0]
        check(status == 200 and "HttpOnly" in headers["Set-Cookie"] and "Max-Age=28800" in headers["Set-Cookie"], "login cookie")
        status, _, headers2 = call("POST", "/api/auth/login", dict(email=email, password=password))
        cookie2 = headers2["Set-Cookie"].split(";")[0]
        rows = sql("SELECT TIMESTAMPDIFF(SECOND,created_at,expires_at) AS ttl FROM auth_sessions WHERE token_hash=%s", (token_hash(cookie.split("=", 1)[1]),))
        check(rows[0]["ttl"] == 28800, "database eight-hour TTL")
        check(call("GET", "/api/users/me")[0] == 401, "anonymous read")
        check(call("PATCH", "/api/users/me", {"name": "blocked"})[0] == 401, "anonymous update")
        for payload in ({}, {"name":None}, {"phone":None}, {"name":"   "}, {"phone":"1234567"}, {"phone":"0"*21}, {"name":"字"*101}, {"role":"system_admin"}, {"email":"other@example.com"}, {"user_id":1,"name":"blocked"}, {"password":"NewPassword!"}, {"is_active":False}):
            check(call("PATCH", "/api/users/me", payload, cookie)[0] == 422, "invalid profile " + str(list(payload)))
        for payload in ({"name":"𠮷"*100}, {"name":"甲"}, {"phone":"01234567"}, {"phone":"0"*20}, {"name":" 更新後 ","phone":" 0987654321 "}):
            status, updated, _ = call("PATCH", "/api/users/me", payload, cookie)
            check(status == 200 and updated["id"] == uid and updated["role"] == "resident", "valid profile " + str(list(payload)))
        check(call("GET", "/api/users/me", cookie=cookie)[1]["user"]["name"] == "更新後", "profile persisted")
        check(call("PATCH", "/api/users/me", {"name":"blocked"}, cookie, "null")[0] == 403, "null origin rejected")
        check(call("POST", "/api/auth/logout", cookie=cookie)[0] == 204, "logout")
        check(call("GET", "/api/users/me", cookie=cookie)[0] == 401, "revoked token replay rejected")
        check(call("GET", "/api/users/me", cookie=cookie2)[0] == 200, "other device remains logged in")
        check(call("POST", "/api/auth/logout")[0] == 204, "repeat logout")
        sql("UPDATE auth_sessions SET created_at=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 9 HOUR), expires_at=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 HOUR) WHERE token_hash=%s", (token_hash(cookie2.split("=",1)[1]),))
        check(call("GET", "/api/users/me", cookie=cookie2)[0] == 401, "expired session rejected")
        _, _, h = call("POST", "/api/auth/login", dict(email=email,password=password))
        active_cookie = h["Set-Cookie"].split(";")[0]
        sql("UPDATE users SET is_active=FALSE WHERE id=%s", (uid,))
        check(call("GET", "/api/users/me", cookie=active_cookie)[0] == 401, "disabled user read rejected")
        check(call("PATCH", "/api/users/me", {"name":"blocked"}, active_cookie)[0] == 401, "disabled user update rejected")
        check(call("POST", "/api/auth/login", dict(email=email,password=password))[0] == 401, "disabled user login rejected")
        # 獨立資料庫才可建立管理員測試資料，不提供公開升權 API。
        admin_email = "initial-admin@example.com"
        admin_data = RegisterRequest(name="系統管理員",email=admin_email,phone="0912345678",password=password)
        bootstrap(admin_data)
        check(bootstrap(admin_data) is False, "bootstrap idempotent")
        manager_email = f"manager-{suffix}@example.com"
        sql("INSERT INTO users (name,email,phone,password_hash,role,is_active,created_at,updated_at) VALUES (%s,%s,%s,%s,'building_admin',TRUE,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))", ("管理員",manager_email,"0912345678",hasher.hash(password)))
        for role, account in (("system_admin",admin_email),("building_admin",manager_email)):
            status, result, h = call("POST", "/api/auth/login", dict(email=account,password=password))
            check(status == 200 and result["role"] == role, role + " login")
            check(call("PATCH", "/api/users/me", {"name":"管理員更新"}, h["Set-Cookie"].split(";")[0])[0] == 200, role + " own profile")
        bucket = token_hash("parallel-" + suffix)
        with ThreadPoolExecutor(max_workers=10) as executor:
            results = list(executor.map(lambda _: consume(bucket, 3, 60), range(10)))
        check(results.count(0) == 3, "parallel rate limit exactly three allowed")
        for _ in range(25):
            status, _, h = call("POST", "/api/auth/login", dict(email=email,password=password))
            if status == 429: break
        check(status == 429 and int(h["Retry-After"]) > 0, "HTTP login throttle")
        for _ in range(12):
            status, _, h = call("POST", "/api/auth/register", data)
            if status == 429: break
        check(status == 429 and int(h["Retry-After"]) > 0, "HTTP registration throttle")
        print(f"2A acceptance: {count} checks passed", flush=True)
    finally:
        process.terminate()
        process.wait(timeout=10)


if __name__ == "__main__": run()
