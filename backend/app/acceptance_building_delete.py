"""D-27 HTTP 角色與並行刪除驗收，僅使用獨立測試庫。"""
import os
import secrets
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from app import acceptance_domain as test
from app.test_support import wait_for_server


def run():
    if os.getenv('DB_NAME') != 'parcel_management_test':
        raise RuntimeError('只允許獨立測試庫。')
    test.BASE = 'http://127.0.0.1:19001'
    env = dict(os.environ, CORS_ORIGINS='http://localhost:3001', COOKIE_SECURE='false')
    process = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '19001', '--no-access-log'], env=env)
    try:
        wait_for_server(process, lambda: test.call('GET', '/health')[0] == 200, attempts=300)
        password = 'Acceptance2026!'
        def login(email):
            return test.call('POST', '/api/auth/login', dict(email=email,password=password), expected=200)[2]['Set-Cookie'].split(';')[0]
        root = login('initial-admin@example.com')
        suffix = secrets.token_hex(6)
        def req(method,path,data=None,status=200,cookie=root):
            return test.call(method,path,data,cookie,status)[1]
        resident_email = 'delete-resident-'+suffix+'@example.com'
        req('POST','/api/auth/register',dict(name='刪除驗收住戶',email=resident_email,phone='0912345678',password=password),201)
        resident=login(resident_email)
        def building():
            return req('POST','/api/buildings',dict(name='刪除並行驗收'+suffix,address='測試'),201)['id']
        home=building()
        test.check(req('GET',f'/api/buildings/{home}')['can_delete'] is True, 'empty building can delete')
        req('DELETE',f'/api/buildings/{home}',status=403,cookie=resident)
        with ThreadPoolExecutor(2) as pool:
            results=list(pool.map(lambda _:test.call('DELETE',f'/api/buildings/{home}',cookie=root)[0],range(2)))
        test.check(sorted(results)==[204,404], 'parallel delete: one success and one not found')
        home=building()
        manager=req('POST',f'/api/buildings/{home}/admins',dict(name='並行管理員',email='delete-manager-'+suffix+'@example.com',phone='0912345678',password=password),201)['user']['id']
        test.check(req('GET',f'/api/buildings/{home}')['can_delete'] is False, 'assigned building hides delete')
        req('DELETE',f'/api/buildings/{home}',status=409)
        manager_cookie=login('delete-manager-'+suffix+'@example.com')
        test.check(req('GET',f'/api/buildings/{home}',cookie=manager_cookie)['can_delete'] is False, 'manager cannot delete')
        req('POST',f'/api/buildings/{home}/units',dict(floor='1F',unit_number='1A'),201,cookie=manager_cookie)
        req('DELETE',f'/api/buildings/{home}/admins/{manager}',status=204)
        test.check(req('GET',f'/api/buildings/{home}')['can_delete'] is False, 'unit alone hides delete')
        req('DELETE',f'/api/buildings/{home}',status=409)
        for _ in range(3):
            bid=building()
            with ThreadPoolExecutor(2) as pool:
                assign=pool.submit(test.call,'POST',f'/api/buildings/{bid}/admins',dict(user_id=manager),root)
                delete=pool.submit(test.call,'DELETE',f'/api/buildings/{bid}',None,root)
                statuses=(assign.result()[0],delete.result()[0])
            test.check(statuses in ((201,409),(404,204)), 'assignment/delete never deletes assigned building')
            if statuses[0]==201:
                req('DELETE',f'/api/buildings/{bid}/admins/{manager}',status=204)
                req('DELETE',f'/api/buildings/{bid}',status=204)
        print(f'Delete acceptance: {test.COUNT} checks passed',flush=True)
    finally:
        process.terminate()
        process.wait(timeout=10)

if __name__ == '__main__':
    run()
