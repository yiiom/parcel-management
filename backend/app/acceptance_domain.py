"""DB／後端整合驗收：真實 HTTP、MySQL、並行請求；只使用獨立測試庫。"""
import json
import os
import secrets
import subprocess
import sys
import re
from pathlib import Path
from tempfile import TemporaryDirectory
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from app.acceptance_2a import sql
from app.migrate import migrate
from app.bootstrap_admin import bootstrap
from app.schemas.accounts import RegisterRequest, User
from app.core import codes
from app.services.base import BaseService
from app.services.transactions import transaction
from app.test_support import wait_for_server

BASE='http://127.0.0.1:19000'
COUNT=0
SEEN=set()

def call(method,path,body=None,cookie=None,expected=None):
    global COUNT
    headers={'Content-Type':'application/json','Origin':'http://localhost:3001'}
    if cookie: headers['Cookie']=cookie
    req=Request(BASE+path,data=json.dumps(body).encode() if body is not None else None,headers=headers,method=method)
    try: response=urlopen(req,timeout=30)
    except HTTPError as exc: response=exc
    with response:
        raw=response.read()
        result=json.loads(raw) if raw else None
        status=response.status
        if expected is not None:
            assert status==expected,(method,path,status,result)
            COUNT+=1
        SEEN.add((method,path.split('?')[0]))
        return status,result,response.headers

def check(value,label):
    global COUNT
    assert value,label
    COUNT+=1
    print('PASS',label,flush=True)

def run():
    if os.getenv('DB_NAME')!='parcel_management_test': raise RuntimeError('只允許獨立測試庫。')
    migrate()
    migrate()
    # 真實資料庫已有 migration 時，拒絕來源漂移與未完成狀態。
    with TemporaryDirectory() as directory:
        altered = Path(directory) / 'migrations'
        altered.mkdir()
        (altered / '001_users.sql').write_text('SELECT 1', encoding='utf-8')
        try:
            with patch('app.migrate.Path', return_value=Path(directory) / 'migrate.py'):
                migrate(max_version=1)
        except RuntimeError:
            check(True, 'migration rejects checksum drift')
        else:
            raise AssertionError('已套用的 migration 來源變動未被拒絕')
    sql("UPDATE schema_migrations SET status='applying' WHERE version='001_users.sql'")
    try:
        try:
            migrate(max_version=1)
        except RuntimeError:
            check(True, 'migration rejects incomplete version')
        else:
            raise AssertionError('未完成的 migration 未被拒絕')
    finally:
        sql("UPDATE schema_migrations SET status='applied' WHERE version='001_users.sql'")
    sql('UPDATE auth_rate_limits SET window_start=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 2 HOUR)')
    password='Acceptance2026!'
    admin='initial-admin@example.com'
    bootstrap(RegisterRequest(name='系統管理員',email=admin,phone='0912345678',password=password))
    env=dict(os.environ,CORS_ORIGINS='http://localhost:3001',API_ORIGINS='http://localhost:19000',COOKIE_SECURE='false')
    process=subprocess.Popen([sys.executable,'-m','uvicorn','app.main:app','--host','127.0.0.1','--port','19000','--no-access-log'],env=env)
    try:
        wait_for_server(process, lambda: call('GET', '/health')[0] == 200, attempts=80)
        suffix=secrets.token_hex(5)
        def login(email):
            return call('POST','/api/auth/login',dict(email=email,password=password),expected=200)[2]['Set-Cookie'].split(';')[0]
        root=login(admin)
        def req(method,path,data=None,actor=root,status=200):
            return call(method,path,data,actor,status)[1]
        empty=req('POST','/api/buildings',dict(name='可刪除'+suffix,address='測試'),status=201)['id']
        req('DELETE',f'/api/buildings/{empty}',actor=None,status=401)
        req('DELETE',f'/api/buildings/{empty}',{},status=422)
        req('DELETE',f'/api/buildings/{empty}',status=204)
        req('GET',f'/api/buildings/{empty}',status=404)
        req('DELETE',f'/api/buildings/{empty}',status=404)
        b1=req('POST','/api/buildings',dict(name='驗收甲'+suffix,address='甲地址'),status=201)['id']
        b2=req('POST','/api/buildings',dict(name='驗收乙'+suffix,address='乙地址'),status=201)['id']
        req('GET','/api/buildings?page=1&page_size=1')
        req('GET','/api/buildings?page_size=101',status=422)
        req('GET',f'/api/buildings/{b1}',actor=None,status=401)
        req('PATCH',f'/api/buildings/{b1}',dict(phone=None,name='大樓甲'))
        req('PATCH',f'/api/buildings/{b1}',dict(name=None),status=422)
        managers=[]
        for n,bid in enumerate((b1,b1,b2)):
            email=f'mgr-{suffix}-{n}@example.com'
            value=req('POST',f'/api/buildings/{bid}/admins',dict(name=f'管理員{n}',email=email,phone='0912345678',password=password),status=201)
            managers.append((login(email),value['user']['id']))
        (m1,mid1),(m2,mid2),(m3,mid3)=managers
        req('GET',f'/api/buildings/{b1}/admins')
        req('POST',f'/api/buildings/{b2}/admins',dict(user_id=mid1),status=409)
        req('GET',f'/api/buildings/{b2}',actor=m1,status=403)
        req('GET','/api/building-admins',actor=m1,status=403)
        req('GET','/api/building-admins')
        req('PATCH',f'/api/buildings/{b1}',dict(address='更新地址'),actor=m1)
        req('POST','/api/buildings',dict(name='拒絕',address='拒絕'),actor=m1,status=403)
        me=req('GET','/api/users/me',actor=m1)
        check(me['managed_building_ids']==[b1],'real manager relationship')
        req('DELETE',f'/api/buildings/{b1}/admins/{mid2}',status=204)
        req('GET',f'/api/buildings/{b1}',actor=m2,status=403)
        check(any(r['user_id']==mid2 and r['building_id'] is None for r in req('GET','/api/building-admins?page_size=100')['items']),'unassigned directory')
        req('POST',f'/api/buildings/{b1}/admins',dict(user_id=mid2),status=201)
        def unit(bid,actor,num):
            return req('POST',f'/api/buildings/{bid}/units',dict(floor='B1',unit_number=num),actor=actor,status=201)['id']
        req('DELETE',f'/api/buildings/{b1}',actor=m1,status=403)
        req('DELETE',f'/api/buildings/{b1}',status=409)
        # 移除管理員分配後仍有戶別，必須拒絕刪除。
        isolated=req('POST','/api/buildings',dict(name='有戶別'+suffix,address='測試'),status=201)['id']
        req('DELETE',f'/api/buildings/{b1}/admins/{mid2}',status=204)
        req('POST',f'/api/buildings/{isolated}/admins',dict(user_id=mid2),status=201)
        unit(isolated,m2,'1A')
        req('DELETE',f'/api/buildings/{isolated}/admins/{mid2}',status=204)
        req('DELETE',f'/api/buildings/{isolated}',status=409)
        req('POST',f'/api/buildings/{b1}/admins',dict(user_id=mid2),status=201)
        u1=unit(b1,m1,'3A'); u2=unit(b1,m1,'3B'); u3=unit(b2,m3,'3A')
        req('POST',f'/api/buildings/{b1}/units',dict(floor='2F',unit_number='3A'),actor=m1,status=409)
        req('GET',f'/api/buildings/{b1}/units?floor=B1',actor=m1)
        req('PATCH',f'/api/units/{u1}',dict(floor='3F'),actor=m1)
        req('PATCH',f'/api/units/{u1}',dict(building_id=b2),actor=m1,status=422)
        req('PATCH',f'/api/units/{u1}',dict(floor='4F'),actor=m3,status=403)
        with ThreadPoolExecutor(2) as pool:
            attempts=list(pool.map(lambda _:call('POST',f'/api/units/{u1}/occupancies',cookie=m1),range(2)))
        check(sorted(r[0] for r in attempts)==[201,409],'parallel occupancy unique')
        o1=next(r[1]['id'] for r in attempts if r[0]==201)
        o2=req('POST',f'/api/units/{u2}/occupancies',actor=m1,status=201)['id']
        o3=req('POST',f'/api/units/{u3}/occupancies',actor=m3,status=201)['id']
        req('GET',f'/api/units/{u1}/occupancies',actor=m1)
        def invite(oid,actor=m1):
            return req('POST',f'/api/occupancies/{oid}/invite-codes',actor=actor,status=201)
        old=invite(o1); inv=invite(o1); inv2=invite(o2); inv3=invite(o3,m3)
        check(len(inv['code'])==4 and inv['code'].isdigit() and inv['code']!=old['code'],'invite format and replacement')
        rows=req('GET',f'/api/occupancies/{o1}/invite-codes',actor=m1)['items']
        check(all('code' not in r and 'code_hash' not in r for r in rows),'invite list never exposes secret')
        check(sql('SELECT TIMESTAMPDIFF(SECOND,created_at,expires_at) ttl FROM unit_invite_codes WHERE id=%s',(inv['id'],))[0]['ttl']==86400,'invite fixed TTL')
        req('POST',f'/api/occupancies/{o1}/invite-codes',dict(expires_at='2099-01-01'),actor=m1,status=422)
        residents=[]
        for n in range(5):
            email=f'res-{suffix}-{n}@example.com'
            value=req('POST','/api/auth/register',dict(name=f'住戶{n}',email=email,phone='0912345678',password=password),actor=None,status=201)
            residents.append((login(email),value['id']))
        (r1,rid1),(r2,rid2),(r3,rid3),(r4,rid4),(r5,rid5)=residents
        req('POST',f'/api/buildings/{b1}/admins',dict(user_id=rid1),status=409)
        req('GET','/api/buildings',actor=r1,status=403)
        req('POST','/api/unit-invitations/verify',dict(invite_code=old['code']),actor=r1,status=400)
        req('POST','/api/unit-invitations/verify',dict(invite_code=inv['code']),actor=r1)
        def join(code,actor,status=201): return req('POST','/api/unit-memberships',dict(invite_code=code),actor=actor,status=status)
        mem1=join(inv['code'],r1)
        join(inv['code'],r1,200)
        join(inv2['code'],r1,409)
        mem2=join(inv['code'],r2)
        join(inv3['code'],r3)
        with ThreadPoolExecutor(2) as pool:
            joined=list(pool.map(lambda code:call('POST','/api/unit-memberships',dict(invite_code=code),r4),[inv['code'],inv2['code']]))
        check(sorted(r[0] for r in joined)==[201,409],'parallel cross-unit join unique')
        check(req('GET','/api/users/me',actor=r1)['memberships'][0]['occupancy_id']==o1,'real resident relationship')
        req('GET',f'/api/buildings/{b1}/memberships?occupancy_id={o1}',actor=m1)
        req('GET',f'/api/buildings/{b1}/memberships',actor=m3,status=403)
        # 無效碼：使用不在有效集合中的值，測試不受隨機碼碰撞影響。
        hashes={r['code_hash'] for r in sql('SELECT code_hash FROM unit_invite_codes WHERE disabled_at IS NULL AND expires_at>UTC_TIMESTAMP(6)')}
        bad=next(f'{i:04d}' for i in range(10000) if codes.digest('invite',f'{i:04d}') not in hashes)
        for i in range(5): req('POST','/api/unit-invitations/verify',dict(invite_code=bad),actor=r5,status=400 if i<4 else 429)
        req('POST','/api/unit-memberships',dict(invite_code=inv['code']),actor=r5,status=429)
        req('GET','/api/users/me',actor=r5)
        sql("UPDATE code_attempts SET blocked_until=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 SECOND) WHERE user_id=%s AND purpose='invite'",(rid5,))
        req('POST','/api/unit-invitations/verify',dict(invite_code=inv['code']),actor=r5)
        req('POST',f'/api/invite-codes/{inv2["id"]}/deactivate',actor=m1)
        req('POST','/api/unit-invitations/verify',dict(invite_code=inv2['code']),actor=r5,status=400)
        expired=invite(o2)
        sql('UPDATE unit_invite_codes SET created_at=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 25 HOUR),expires_at=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 HOUR) WHERE id=%s',(expired['id'],))
        req('POST','/api/unit-invitations/verify',dict(invite_code=expired['code']),actor=r5,status=400)
        check(req('GET',f'/api/occupancies/{o2}/invite-codes',actor=m1)['items'][0]['status']=='expired','expired invite status')
        def parcel(**extra):
            return req('POST','/api/parcels',dict(occupancy_id=o1,recipient_name='收件人',**extra),actor=m1,status=201)
        p=parcel(courier='物流',tracking_number=suffix)
        pid=p['id']
        warning=req('POST','/api/parcels',dict(occupancy_id=o1,recipient_name='收件人',courier='物流',tracking_number=suffix),actor=m1,status=409)
        check(warning['existing_parcels'][0]['id']==pid,'duplicate requires explicit confirmation')
        parcel(courier='物流',tracking_number=suffix,duplicate_confirmed=True)
        first_page=req('GET',f'/api/parcels?occupancy_id={o1}&page_size=1&page=1&status=pending',actor=r1)
        second_page=req('GET',f'/api/parcels?occupancy_id={o1}&page_size=1&page=2&status=pending',actor=r1)
        check(first_page['total']==2 and second_page['total']==2 and len(first_page['items'])==1 and second_page['items'][0]['id']==pid and first_page['items'][0]['id']>pid,'parcel pagination preserves total and newest-first order')
        check('pickup_code' not in p and 'pickup_code_encrypted' not in p and 'pickup_code_hash' not in p,'parcel response hides codes')
        req('GET',f'/api/parcels/{pid}',actor=r3,status=403)
        req('GET',f'/api/parcels/{pid}',actor=root,status=403)
        req('GET','/api/parcels',actor=root,status=403)
        req('GET',f'/api/parcels?building_id={b1}&keyword={suffix}',actor=r1)
        check(req('GET',f'/api/parcels?building_id={b1}',actor=m3)['total']==0,'list filters cannot widen scope')
        req('GET',f'/api/parcels/{pid}/pickup-code',actor=m1,status=403)
        code=req('GET',f'/api/parcels/{pid}/pickup-code',actor=r1)['pickup_code']
        check(len(code)==6 and code.isdigit(),'pickup format')
        def verify(code,bid=b1,actor=m1,status=200): return req('POST','/api/pickup-verifications',dict(building_id=bid,pickup_code=code),actor=actor,status=status)
        v=verify(code); vid=v['id']
        check(verify(code)['id']==vid,'same manager verification idempotency')
        verify(code,actor=m2,status=409)
        pickup_hashes={r['pickup_code_hash'] for r in sql("SELECT pickup_code_hash FROM parcels WHERE code_building_id=%s AND status='pending'",(b1,))}
        bad_pickup=next(f'{i:06d}' for i in range(1000000) if codes.digest('pickup',f'{i:06d}') not in pickup_hashes)
        for i in range(5): verify(bad_pickup,actor=m2,status=400 if i<4 else 429)
        verify(code,actor=m2,status=429)
        verify(code)  # 其他管理員不受影響。
        req('GET',f'/api/buildings/{b1}',actor=m2)
        sql("UPDATE code_attempts SET blocked_until=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 SECOND) WHERE user_id=%s AND purpose='pickup'",(mid2,))
        req('GET',f'/api/pickup-verifications/{vid}',actor=m2,status=403)
        req('GET',f'/api/pickup-verifications/{vid}',actor=r1)
        req('POST',f'/api/pickup-verifications/{vid}/confirm',actor=m1,status=403)
        req('PATCH',f'/api/parcels/{pid}',dict(note='更正備註'),actor=m1)
        check(req('GET',f'/api/pickup-verifications/{vid}',actor=r1)['status']=='cancelled','real edit cancels verification')
        check(req('GET',f'/api/parcels/{pid}/pickup-code',actor=r1)['pickup_code']==code,'non-occupancy edit preserves code')
        req('POST',f'/api/pickup-verifications/{vid}/confirm',actor=r1,status=409)
        v=verify(code)
        req('PATCH',f'/api/parcels/{pid}',dict(note='更正備註'),actor=m1)
        check(req('GET',f'/api/pickup-verifications/{v["id"]}',actor=r1)['status']=='awaiting_confirmation','no-op edit preserves verification')
        req('POST',f'/api/pickup-verifications/{v["id"]}/cancel',actor=m1)
        v=verify(code)
        sql('UPDATE pickup_verifications SET verified_at=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 11 MINUTE),expires_at=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 MINUTE) WHERE id=%s',(v['id'],))
        req('POST',f'/api/pickup-verifications/{v["id"]}/confirm',actor=r1,status=410)
        v=verify(code)
        # 在真實交易插入簽收後注入第二步失敗，不要求資料庫 SUPER 權限。
        signer=User.model_validate(sql('SELECT * FROM users WHERE id=%s',(rid1,))[0])
        try:
            with patch.object(BaseService,'update',side_effect=RuntimeError('驗收注入失敗')):
                with transaction(signer) as service: service.pickups.confirm(v['id'])
        except RuntimeError: pass
        else: raise AssertionError('故障注入未觸發')
        check(not sql('SELECT id FROM parcel_pickups WHERE parcel_id=%s',(pid,)),'failed confirmation rolls back receipt')
        check(req('GET',f'/api/parcels/{pid}',actor=r1)['status']=='pending','failed confirmation rolls back parcel')
        with ThreadPoolExecutor(2) as pool:
            confirmed=list(pool.map(lambda actor:call('POST',f'/api/pickup-verifications/{v["id"]}/confirm',cookie=actor),[r1,r2]))
        check(sorted(r[0] for r in confirmed)==[200,409],'parallel confirmation only one winner')
        receipt=next(r[1] for r in confirmed if r[0]==200)
        winner=r1 if receipt['picked_up_by']==rid1 else r2
        loser=r2 if winner==r1 else r1
        check(req('POST',f'/api/pickup-verifications/{v["id"]}/confirm',actor=winner)['id']==receipt['id'],'same signer retry')
        req('POST',f'/api/pickup-verifications/{v["id"]}/confirm',actor=loser,status=409)
        req('GET',f'/api/parcels/{pid}/pickup-code',actor=r1,status=409)
        req('POST',f'/api/pickup-verifications/{v["id"]}/cancel',actor=m1,status=409)
        req('PUT',f'/api/parcels/{pid}/exception',dict(exception_reason='拒絕'),actor=m1,status=409)
        req('PATCH','/api/users/me',dict(name='後來改名'),actor=winner)
        req('PATCH','/api/users/me',dict(name='管理員後來改名'),actor=m1)
        saved=req('GET',f'/api/pickups?occupancy_id={o1}',actor=r1)['items'][0]
        check(saved['picked_up_by_name']==receipt['picked_up_by_name'] and saved['handled_by_name']==receipt['handled_by_name'],'historical names remain snapshots')
        join(inv['code'],r5)
        check(req('GET',f'/api/pickups?occupancy_id={o1}',actor=r5)['total']==1,'late household member sees prior receipt')
        req('GET','/api/pickups?date_from=2026-10-16&date_to=2026-10-15',actor=r1,status=422)
        original_time=sql('SELECT picked_up_at FROM parcel_pickups WHERE id=%s',(receipt['id'],))[0]['picked_up_at']
        try:
            for timestamp,expected_total in [
                ('2026-10-14 15:59:59.999999',0),
                ('2026-10-14 16:00:00.000000',1),
                ('2026-10-15 15:59:59.999999',1),
                ('2026-10-15 16:00:00.000000',0),
            ]:
                sql('UPDATE parcel_pickups SET picked_up_at=%s WHERE id=%s',(timestamp,receipt['id']))
                day=req('GET',f'/api/pickups?occupancy_id={o1}&date_from=2026-10-15&date_to=2026-10-15',actor=r1)
                check(day['total']==expected_total,'Taiwan date inclusive boundary '+timestamp)
        finally:
            sql('UPDATE parcel_pickups SET picked_up_at=%s WHERE id=%s',(original_time,receipt['id']))
        ex=parcel(); exid=ex['id']
        oldcode=req('GET',f'/api/parcels/{exid}/pickup-code',actor=r1)['pickup_code']
        ev=verify(oldcode)
        req('PUT',f'/api/parcels/{exid}/exception',dict(exception_reason='破損'),actor=m1)
        check(req('GET',f'/api/pickup-verifications/{ev["id"]}',actor=r1)['status']=='cancelled','exception cancels verification')
        req('GET',f'/api/parcels/{exid}/pickup-code',actor=r1,status=409)
        req('POST',f'/api/parcels/{exid}/exception/resolve',dict(status='pending',resolution_note='已核對'),actor=m1)
        newcode=req('GET',f'/api/parcels/{exid}/pickup-code',actor=r1)['pickup_code']
        check(newcode!=oldcode,'exception recovery rotates code')
        verify(oldcode,status=400)
        req('PUT',f'/api/parcels/{exid}/exception',dict(exception_reason='再次破損'),actor=m1)
        check(req('GET',f'/api/parcels/{exid}',actor=r1)['resolution_note'] is None,'new exception clears old resolution')
        req('POST',f'/api/unit-memberships/{mem1["id"]}/exit-request',actor=r1)
        req('GET',f'/api/parcels/{pid}',actor=r1)
        req('POST',f'/api/unit-memberships/{mem1["id"]}/exit-request',actor=r1)
        req('POST',f'/api/unit-memberships/{mem2["id"]}/exit-request',actor=r1,status=403)
        req('POST',f'/api/unit-memberships/{mem1["id"]}/revoke',actor=m1)
        req('GET',f'/api/parcels/{pid}',actor=r1,status=403)
        fresh=invite(o1)
        req('POST',f'/api/unit-memberships/{mem1["id"]}/revoke',actor=m1)
        req('POST','/api/unit-invitations/verify',dict(invite_code=fresh['code']),actor=r1)
        memnew=join(fresh['code'],r1)
        check(memnew['id']!=mem1['id'],'rejoin creates new membership and retains history')
        # 更換入住只限同棟，並換碼；換回後仍能正常處理。
        move=parcel(); moveid=move['id']
        moveold=req('GET',f'/api/parcels/{moveid}/pickup-code',actor=r1)['pickup_code']
        req('PATCH',f'/api/parcels/{moveid}',dict(occupancy_id=o3),actor=m1,status=403)
        req('PATCH',f'/api/parcels/{moveid}',dict(occupancy_id=o2),actor=m1)
        req('GET',f'/api/parcels/{moveid}',actor=r1,status=403)
        req('PATCH',f'/api/parcels/{moveid}',dict(occupancy_id=o1),actor=m1)
        check(req('GET',f'/api/parcels/{moveid}/pickup-code',actor=r1)['pickup_code']!=moveold,'occupancy correction rotates pickup code')
        pending=parcel()
        pv=verify(req('GET',f'/api/parcels/{pending["id"]}/pickup-code',actor=r1)['pickup_code'])
        ended=req('POST',f'/api/occupancies/{o1}/end',actor=m1)
        check(req('POST',f'/api/occupancies/{o1}/end',actor=m1)['ended_at']==ended['ended_at'],'end occupancy retry preserves time')
        req('GET',f'/api/parcels/{pid}',actor=r1,status=403)
        req('POST',f'/api/pickup-verifications/{pv["id"]}/confirm',actor=r1,status=403)
        req('POST','/api/unit-invitations/verify',dict(invite_code=fresh['code']),actor=r1,status=400)
        req('POST',f'/api/parcels/{exid}/exception/resolve',dict(status='pending',resolution_note='不應成功'),actor=m1,status=409)
        req('PATCH',f'/api/parcels/{exid}',dict(occupancy_id=o2),actor=m1,status=409)
        returned=req('POST',f'/api/parcels/{exid}/exception/resolve',dict(status='returned',resolution_note='已退物流'),actor=m1)
        check(returned['status']=='returned','ended occupancy permits return only')
        check(req('GET',f'/api/parcels/{pending["id"]}',actor=m1)['status']=='exception','move-out pending parcel becomes exception')
        check(req('GET',f'/api/parcels/{pid}',actor=m1)['status']=='picked_up','move-out does not rewrite signed parcel')
        newocc=req('POST',f'/api/units/{u1}/occupancies',actor=m1,status=201)['id']
        newinvite=invite(newocc)
        join(newinvite['code'],r1)
        req('GET',f'/api/parcels/{pid}',actor=r1,status=403)
        check(req('GET','/api/pickups',actor=r1)['total']==0,'new occupancy cannot read previous receipts')
        # 撤銷與確認並行：不論誰先完成，撤銷回應後原帳號一定不可再查詢／確認。
        race_member=join(newinvite['code'],r2)
        race_parcel=req('POST','/api/parcels',dict(occupancy_id=newocc,recipient_name='並行測試'),actor=m1,status=201)
        race_code=req('GET',f'/api/parcels/{race_parcel["id"]}/pickup-code',actor=r2)['pickup_code']
        race_ver=verify(race_code)
        with ThreadPoolExecutor(2) as pool:
            a=pool.submit(call,'POST',f'/api/unit-memberships/{race_member["id"]}/revoke',None,m1)
            b=pool.submit(call,'POST',f'/api/pickup-verifications/{race_ver["id"]}/confirm',None,r2)
            check(a.result()[0]==200 and b.result()[0] in (200,403),'revoke and confirm serialize consistently')
        req('GET',f'/api/parcels/{race_parcel["id"]}',actor=r2,status=403)
        req('POST',f'/api/pickup-verifications/{race_ver["id"]}/confirm',actor=r2,status=403)
        # 整戶結束與確認並行：成功簽收不得被覆寫為異常，否則維持未簽收異常。
        end_race=req('POST','/api/parcels',dict(occupancy_id=newocc,recipient_name='結束並行'),actor=m1,status=201)
        end_ver=verify(req('GET',f'/api/parcels/{end_race["id"]}/pickup-code',actor=r1)['pickup_code'])
        with ThreadPoolExecutor(2) as pool:
            a=pool.submit(call,'POST',f'/api/occupancies/{newocc}/end',None,m1)
            b=pool.submit(call,'POST',f'/api/pickup-verifications/{end_ver["id"]}/confirm',None,r1)
            outcome=b.result()[0]
            check(a.result()[0]==200 and outcome in (200,403),'end and confirm serialize consistently')
        final=req('GET',f'/api/parcels/{end_race["id"]}',actor=m1)
        check(final['status']==('picked_up' if outcome==200 else 'exception'),'end and confirm preserve correct terminal state')
        req('GET',f'/api/parcels/{end_race["id"]}',actor=r1,status=403)
        # 入住結束跨多表的中途失敗須全部還原。
        atomic_invite=invite(o2)
        atomic_member=join(atomic_invite['code'],r2)
        atomic_parcel=req('POST','/api/parcels',dict(occupancy_id=o2,recipient_name='交易回滾'),actor=m1,status=201)
        atomic_ver=verify(req('GET',f'/api/parcels/{atomic_parcel["id"]}/pickup-code',actor=r2)['pickup_code'])
        manager=User.model_validate(sql('SELECT * FROM users WHERE id=%s',(mid1,))[0])
        original_update=BaseService.update
        def fail_parcel(service,table,ident,values):
            if table=='parcels': raise RuntimeError('驗收注入失敗')
            return original_update(service,table,ident,values)
        try:
            with patch.object(BaseService,'update',fail_parcel):
                with transaction(manager) as service: service.occupancies.end_occupancy(o2)
        except RuntimeError: pass
        else: raise AssertionError('故障注入未觸發')
        check(sql('SELECT ended_at FROM occupancies WHERE id=%s',(o2,))[0]['ended_at'] is None,'move-out rollback restores occupancy')
        check(sql('SELECT status FROM unit_memberships WHERE id=%s',(atomic_member['id'],))[0]['status']=='active','move-out rollback restores membership')
        check(sql('SELECT disabled_at FROM unit_invite_codes WHERE id=%s',(atomic_invite['id'],))[0]['disabled_at'] is None,'move-out rollback restores invite')
        check(req('GET',f'/api/pickup-verifications/{atomic_ver["id"]}',actor=r2)['status']=='awaiting_confirmation','move-out rollback restores verification')
        check(req('GET',f'/api/parcels/{atomic_parcel["id"]}',actor=r2)['status']=='pending','move-out rollback restores parcel')
        # 模擬 10,000 個邀請碼占滿：拒絕重發，而且舊有效碼不會被先停用。
        full_space=[{'code_hash':codes.digest('invite',f'{i:04d}')} for i in range(10000)]
        try:
            with transaction(manager) as service:
                with patch.object(service.invitations,'all',return_value=full_space): service.invitations.create_invite(o2)
        except Exception as exc: check(getattr(exc,'status',None)==409,'invite exhaustion returns conflict')
        else: raise AssertionError('碼空間已滿卻成功')
        req('POST','/api/unit-invitations/verify',dict(invite_code=atomic_invite['code']),actor=r2)
        # 取消分配後，即使知道驗證 ID 也失去舊範圍。
        req('DELETE',f'/api/buildings/{b1}/admins/{mid1}',status=204)
        req('GET',f'/api/parcels/{pid}',actor=m1,status=403)
        req('GET',f'/api/pickup-verifications/{pv["id"]}',actor=m1,status=403)
        req('GET',f'/api/parcels/{pid}',actor=m2)
        req('POST','/api/auth/logout',actor=m2,status=204)
        req('GET','/api/users/me',actor=m2,status=401)
        # 契約完整性：40 個操作均已掛載且本輪都有實際 HTTP 呼叫。
        contract=json.loads(Path(__file__).with_name('contract_operations.json').read_text(encoding='utf-8'))
        live=req('GET','/openapi.json')
        expected={(method.upper(),path):op['operationId'] for path,methods in contract.items() for method,op in methods.items()}
        actual={(method.upper(),path):op['operationId'] for path,methods in live['paths'].items() if path.startswith('/api/') for method,op in methods.items()}
        check(actual==expected and len(expected)==40,'all 40 operations match contract')
        missing=[]
        for method,path in expected:
            pattern=re.sub(r'\{[^}]+\}',r'[0-9]+',path)
            if not any(m==method and re.fullmatch(pattern,p) for m,p in SEEN): missing.append((method,path))
        check(not missing,'all operations exercised: '+str(missing))
        print(f'Domain acceptance: {COUNT} checks passed',flush=True)
    finally:
        process.terminate()
        process.wait(timeout=10)

if __name__=='__main__': run()
