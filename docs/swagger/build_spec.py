import json
import re
from pathlib import Path

OUT = Path(__file__).resolve().parent
schemas = {}
def ref(n): return {'$ref': '#/components/schemas/' + n}
def string(example=None, **kw):
    s = {'type': 'string', **kw}
    if example is not None: s['example'] = example
    return s
def integer(example=1, **kw): return {'type': 'integer', 'minimum': 1, 'example': example, **kw}
def enum(values, example=None): return string(example or values[0], enum=values)
def array(s): return {'type': 'array', 'items': s}
def obj(props, required=None, **kw):
    return {'type': 'object', 'properties': props, 'required': list(props) if required is None else required, **kw}
def add(n, props, required=None, **kw):
    schemas[n] = obj(props, required, **kw)
    return ref(n)
def req(n, props, required=None, **kw): return add(n, props, required, additionalProperties=False, **kw)
def page(n, item): return add(n, {'items': array(ref(item)), 'total': integer(1, minimum=0), 'page': integer(), 'page_size': integer(20, maximum=100)})
dt = lambda: string('2026-10-08T10:30:00+08:00', format='date-time')
nullable_dt = lambda: {**dt(), 'nullable': True, 'example': None}
roles = ['system_admin', 'building_admin', 'resident']
name = lambda: string('李佳穎', minLength=1, maxLength=100)
phone = lambda: string('0912345678', minLength=8, maxLength=20)
email = lambda: string('resident@example.com', format='email', maxLength=255)
password = lambda: string('DemoPass2026!', minLength=8, maxLength=128, writeOnly=True, format='password')
unit_label = lambda: string('A 棟 5 樓之 1')

add('Error', {'code': string('FORBIDDEN'), 'message': string('你沒有權限執行此操作。'), 'details': array(obj({'field': string('email'), 'message': string('Email 格式不正確。')}))}, ['code', 'message'])
add('Message', {'message': string('操作成功。')})
add('User', {'id': integer(12), 'name': name(), 'phone': phone(), 'email': email(), 'role': enum(roles), 'created_at': dt()})
req('RegisterRequest', {'name': name(), 'phone': phone(), 'email': email(), 'password': password()})
req('LoginRequest', {'email': email(), 'password': password()})
req('ProfileUpdate', {'name': name(), 'phone': phone()}, [], minProperties=1)
add('Building', {'id': integer(1), 'name': string('森光花園'), 'address': string('台北市中山區森光路 18 號'), 'phone': phone(), 'created_at': dt()})
req('BuildingCreate', {'name': string('森光花園', minLength=1, maxLength=100), 'address': string('台北市中山區森光路 18 號', minLength=1, maxLength=200), 'phone': phone()}, ['name', 'address'])
req('BuildingUpdate', schemas['BuildingCreate']['properties'], [], minProperties=1)
req('NewBuildingAdmin', {'name': name(), 'phone': phone(), 'email': email(), 'password': password()})
req('ExistingBuildingAdmin', {'user_id': integer(8, description='必須為既有的大樓管理員帳號。')})
schemas['BuildingAdminAssign'] = {'oneOf': [ref('NewBuildingAdmin'), ref('ExistingBuildingAdmin')], 'description': '二選一：提供新帳號資料，或提供既有管理員 user_id。不能同時提供。'}
add('BuildingAdmin', {'building_id': integer(1), 'user': ref('User')})
add('Unit', {'id': integer(501), 'building_id': integer(1), 'floor': string('5'), 'unit_number': string('A-501'), 'label': unit_label()})
req('UnitCreate', {'floor': string('5', minLength=1, maxLength=20), 'unit_number': string('A-501', minLength=1, maxLength=30)})
req('UnitUpdate', schemas['UnitCreate']['properties'], [], minProperties=1)
add('InviteCode', {'id': integer(21), 'unit_id': integer(501), 'code': string('0382', description='僅授權管理員可讀；不得出現在公開戶別列表。'), 'status': enum(['active', 'expired', 'inactive']), 'expires_at': dt(), 'created_at': dt()})
req('InviteCodeCreate', {'expires_at': dt()})
req('InviteInput', {'invite_code': string('0382', pattern='^[0-9]{4}$', minLength=4, maxLength=4, description='四位數字字串，保留開頭的0。')})
add('InvitationVerified', {'building_id': integer(1), 'building_name': string('森光花園'), 'unit_id': integer(501), 'unit_label': unit_label(), 'expires_at': dt()})
add('Membership', {'id': integer(45), 'user_id': integer(12), 'user_name': name(), 'building_id': integer(1), 'building_name': string('森光花園'), 'unit_id': integer(501), 'unit_label': unit_label(), 'status': enum(['active', 'exit_requested', 'revoked']), 'joined_at': dt(), 'left_at': nullable_dt()})
add('Me', {'user': ref('User'), 'memberships': array(ref('Membership')), 'managed_building_ids': array(integer())})
req('ExitRequest', {'reason': string('已搬離此戶。', maxLength=500)}, [])
req('MembershipRevoke', {'reason': string('已確認住戶搬離。', minLength=1, maxLength=500)})
parcel_status = ['pending', 'picked_up', 'exception', 'returned']
add('Parcel', {'id': integer(125), 'building_id': integer(1), 'unit_id': integer(501), 'unit_label': unit_label(), 'recipient_name': name(), 'carrier': string('黑貓宅急便'), 'tracking_number': string('TC26007128'), 'note': string('外箱完整'), 'status': enum(parcel_status), 'created_by': integer(8), 'arrived_at': dt(), 'picked_up_at': nullable_dt(), 'active_verification_id': {'type': 'integer', 'minimum': 1, 'nullable': True, 'example': 81, 'description': '有效的本次取件驗證 ID；未驗證、過期或完成後為 null。'}})
req('ParcelCreate', {'unit_id': integer(501), 'recipient_name': name(), 'carrier': string('黑貓宅急便', minLength=1, maxLength=50), 'tracking_number': string('TC26007128', minLength=1, maxLength=100), 'note': string('外箱完整', maxLength=500)}, ['unit_id', 'recipient_name', 'carrier', 'tracking_number'])
req('ParcelUpdate', {'unit_id': integer(501), 'recipient_name': name(), 'carrier': string('黑貓宅急便', minLength=1, maxLength=50), 'tracking_number': string('TC26007128', minLength=1, maxLength=100), 'note': string('外箱完整', maxLength=500)}, [], minProperties=1)
add('PickupCode', {'parcel_id': integer(125), 'pickup_code': string('582913', pattern='^[0-9]{6}$', description='須保留字串型別，避免開頭的 0 消失。')})
req('ExceptionCreate', {'type': enum(['refused', 'damaged', 'wrong_recipient', 'other']), 'reason': string('外箱破損，等待住戶確認。', minLength=1, maxLength=500)})
add('ParcelException', {'id': integer(6), 'parcel_id': integer(125), 'type': enum(['refused', 'damaged', 'wrong_recipient', 'other']), 'reason': string('外箱破損，等待住戶確認。'), 'status': enum(['open', 'resolved', 'returned']), 'created_by': integer(8), 'created_at': dt(), 'resolution_note': string('', nullable=True), 'resolved_at': nullable_dt()})
req('ExceptionResolve', {'status': enum(['resolved', 'returned']), 'resolution_note': string('確認無損，恢復待領取。', minLength=1, maxLength=500)})
req('VerificationCreate', {'building_id': integer(1, description='管理員本次正在操作的大樓。'), 'pickup_code': string('582913', pattern='^[0-9]{6}$')})
add('PickupVerification', {'id': integer(81), 'parcel_id': integer(125), 'unit_label': unit_label(), 'carrier': string('黑貓宅急便'), 'status': enum(['awaiting_confirmation', 'completed', 'expired', 'cancelled']), 'verified_by': integer(8), 'verified_at': dt(), 'expires_at': dt(), 'pickup_id': {'type': 'integer', 'minimum': 1, 'nullable': True, 'example': None}})
add('Pickup', {'id': integer(33), 'parcel_id': integer(125), 'verification_id': integer(81), 'unit_label': unit_label(), 'carrier': string('黑貓宅急便'), 'tracking_number': string('TC26007128'), 'confirmed_by': integer(12, description='由登入身分取得，不接受前端指定。'), 'confirmed_by_name': name(), 'handled_by': integer(8), 'handled_by_name': string('陳怡安'), 'confirmed_at': dt()})
for n,item in [('BuildingPage','Building'),('BuildingAdminPage','BuildingAdmin'),('UnitPage','Unit'),('InviteCodePage','InviteCode'),('MembershipPage','Membership'),('ParcelPage','Parcel'),('PickupPage','Pickup'),('ExceptionPage','ParcelException')]: page(n,item)

tag_names = ['帳號與登入', '大樓與管理員', '戶別與邀請碼', '住戶資格與搬離', '包裹管理', '取件與電子簽收']
paths = {}
def query(n, schema, description=''): return {'name':n, 'in':'query', 'required':False, 'description':description, 'schema':schema}
pagination=[query('page', {'type':'integer','minimum':1,'default':1}),query('page_size',{'type':'integer','minimum':1,'maximum':100,'default':20})]
def operation(path, method, tag, ident, title, desc, access, output=None, body=None, status=200, params=None, extra_errors=None):
    parameters=[{'name':n,'in':'path','required':True,'schema':integer(),'description':'資源唯一編號。'} for n in re.findall(r'{(.*?)}',path)]+(params or [])
    op={'tags':[tag_names[tag]],'operationId':ident,'summary':title,'description':'**可使用角色：** '+('未登入者亦可' if not access else '、'.join(access))+'\n\n'+desc,'x-roles':access,'responses':{str(status):{'description':'操作成功。'}}}
    if output: op['responses'][str(status)]['content']={'application/json':{'schema':ref(output)}}
    if parameters:op['parameters']=parameters
    if body:op['requestBody']={'required':True,'content':{'application/json':{'schema':ref(body)}}}
    if not access:op['security']=[]
    errs=set(extra_errors or [])|{422,500}
    if access:errs|={401,403}
    if '{' in path:errs.add(404)
    for code in sorted(errs):op['responses'][str(code)]={'$ref':f'#/components/responses/Error{code}'}
    paths.setdefault(path,{})[method]=op
    return op
S=['系統管理員']; M=['大樓管理員']; R=['住戶']; A=S+M+R
op=operation
op('/api/auth/register','post',0,'register_resident','註冊住戶帳號','公開註冊固定建立 resident 角色；不接受 role 或戶別資格。註冊後呼叫登入，再使用邀請碼加入戶別。',[],'User','RegisterRequest',201,extra_errors=[409,429])
login=op('/api/auth/login','post',0,'login','登入','驗證帳號密碼，回傳使用者並以 HttpOnly Cookie 建立登入狀態。不在 JSON 回傳密碼或 JWT。',[],'User','LoginRequest',extra_errors=[401,429])
login['responses']['200']['headers']={'Set-Cookie':{'description':'正式環境須 HTTPS；Cookie 使用 HttpOnly、Secure、SameSite=Lax、Path=/。','schema':string('access_token=<token>; Path=/; HttpOnly; Secure; SameSite=Lax')}}
logout=op('/api/auth/logout','post',0,'logout','登出','清除登入 Cookie；重複登出也回傳成功。',[],status=204)
logout['responses']['204']['headers']={'Set-Cookie':{'schema':string('access_token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax')}}
op('/api/users/me','get',0,'get_me','取得自己的帳號與資格','僅回傳目前登入者；退出申請中仍有資格，revoked 不具有包裹存取權。',A,'Me')
op('/api/users/me','patch',0,'update_me','修改個人資料','只允許姓名與電話；角色與戶別資格不可透過本 API 修改。',A,'User','ProfileUpdate')
op('/api/buildings','get',1,'list_buildings','取得可管理的大樓','系統管理員可查看全部；大樓管理員只看到被指派的大樓。',S+M,'BuildingPage',params=pagination+[query('keyword',string(), '依大樓名稱搜尋。')])
op('/api/buildings','post',1,'create_building','建立大樓','建立大樓基本資料。',S,'Building','BuildingCreate',201)
op('/api/buildings/{building_id}','get',1,'get_building','取得大樓資料','大樓管理員需具有該大樓管理資格。',S+M,'Building')
op('/api/buildings/{building_id}','patch',1,'update_building','修改大樓資料','檢查角色與大樓範圍。',S+M,'Building','BuildingUpdate')
op('/api/buildings/{building_id}','delete',1,'delete_building','刪除空白大樓','僅系統管理員可刪除；有管理員分配、戶別或任何業務紀錄回傳 409，不存在回傳 404，不連帶刪除。',S,status=204,extra_errors=[409])
op('/api/buildings/{building_id}/admins','post',1,'assign_building_admin','建立或指派大樓管理員','可建立新管理員帳號，或指派既有的大樓管理員帳號。重複指派回傳 409。',S,'BuildingAdmin','BuildingAdminAssign',201,extra_errors=[409])
op('/api/buildings/{building_id}/admins','get',1,'list_building_admins','查看大樓管理員','只供系統管理員查看。',S,'BuildingAdminPage',params=pagination)
op('/api/buildings/{building_id}/units','get',2,'list_units','查看樓層與戶號','只回傳所屬大樓戶別，不回傳邀請碼。',M,'UnitPage',params=pagination+[query('floor',string('5'))])
op('/api/buildings/{building_id}/units','post',2,'create_unit','建立戶別','同棟大樓的 unit_number 不可重複。',M,'Unit','UnitCreate',201,extra_errors=[409])
op('/api/units/{unit_id}','patch',2,'update_unit','更正戶別資料','只更正樓層與戶號，不改變戶別所屬大樓或居住成員。',M,'Unit','UnitUpdate',extra_errors=[409])
op('/api/units/{unit_id}/invite-codes','get',2,'list_invite_codes','查看戶別邀請碼','僅該大樓管理員可讀，紀錄不可公開；過期或停用不取消既有住戶資格。',M,'InviteCodePage',params=pagination)
op('/api/units/{unit_id}/invite-codes','post',2,'create_invite_code','產生或更新邀請碼','expires_at 必須在未來。產生新碼時停用該戶舊碼；不影響既有成員資格。首次交付前的人員確認由管理端作業完成。',M,'InviteCode','InviteCodeCreate',201)
op('/api/invite-codes/{code_id}/deactivate','post',2,'deactivate_invite_code','停用邀請碼','重複停用回傳相同的 inactive 結果。',M,'InviteCode')
op('/api/unit-invitations/verify','post',2,'verify_unit_invitation','驗證戶別邀請碼','僅顯示大樓、戶別與期限，不取得包裹查看權。錯誤、過期及已停用邀請碼統一回傳 INVALID_INVITE_CODE。',R,'InvitationVerified','InviteInput',extra_errors=[400,429])
op('/api/unit-memberships','post',3,'join_unit','確認加入戶別','重新驗證邀請碼後建立戶別資格。第一版每人只允許一個有效戶別（含退出申請中）；變更戶別須先完成原戶別退出。不可用前端傳入的 unit_id 取代邀請碼驗證。',R,'Membership','InviteInput',201,extra_errors=[400,409,429])
op('/api/buildings/{building_id}/memberships','get',3,'list_memberships','查看住戶與退出申請','檢查管理員所屬大樓。',M,'MembershipPage',params=pagination+[query('unit_id',integer(501)),query('status',enum(['active','exit_requested','revoked']))])
op('/api/unit-memberships/{membership_id}/exit-request','post',3,'request_exit','提出退出申請','住戶只能對自己的有效資格提出申請。管理員確認前仍維持原本存取權；重複申請回傳既有 exit_requested 狀態。',R,'Membership','ExitRequest',extra_errors=[409])
op('/api/unit-memberships/{membership_id}/revoke','post',3,'revoke_membership','取消搬離住戶資格','確認搬離後，取消資格、使其不可查看原戶資料並停用該戶現行舊邀請碼。其他成員資格不受影響；大樓端保留歷史簽收紀錄。再次呼叫回傳已取消資格。',M,'Membership','MembershipRevoke')
op('/api/parcels','get',4,'list_parcels','查詢包裹列表','管理員只看負責大樓；住戶只看有效戶別中可供其查看的包裹。查詢條件不能擴大權限。搬離後拒絕原戶存取。排序固定 arrived_at 由新到舊、id 由大到小。',M+R,'ParcelPage',params=pagination+[query('building_id',integer()),query('unit_id',integer(501)),query('status',enum(parcel_status)),query('keyword',string(), '搜尋物流、單號、戶號或收件人。')])
op('/api/parcels','post',4,'create_parcel','登記包裹','從 unit_id 判定大樓並檢查管理權限，登記人從登入帳號取得。建立 pending 包裹並自動產生取件碼；本回應不包含取件碼。相同物流與單號須先提醒，確認後允許新增。',M,'Parcel','ParcelCreate',201,extra_errors=[404,409])
op('/api/parcels/{parcel_id}','get',4,'get_parcel','取得包裹詳情','住戶可透過 active_verification_id 得知有效的取件驗證，再查詢驗證進度。',M+R,'Parcel')
op('/api/parcels/{parcel_id}','patch',4,'update_parcel','更正包裹登記資料','只能更正未領取、未退回包裹。更正戶別須在同棟大樓內，並取消舊取件驗證、更新取件碼，避免原戶領錯。不可直接修改 status 或領取者。',M,'Parcel','ParcelUpdate',extra_errors=[409])
op('/api/parcels/{parcel_id}/pickup-code','get',4,'get_pickup_code','取得包裹取件碼','僅有效且可查看此包裹的住戶能讀取。已領取、異常或退回時回傳 409。回應應帶 Cache-Control: no-store。取件碼不得由日誌或管理員一般列表洩漏。',R,'PickupCode',extra_errors=[409])
op('/api/parcels/{parcel_id}/exceptions','post',4,'create_exception','記錄拒收或異常','適用未領取、未退回包裹。記錄異常後改為 exception，取消進行中的取件驗證並禁止簽收。拒收不代表已退回。',M,'ParcelException','ExceptionCreate',201,extra_errors=[409])
op('/api/parcels/{parcel_id}/exceptions','get',4,'list_exceptions','查看異常處理紀錄','只供該大樓管理員查詢。',M,'ExceptionPage',params=pagination)
op('/api/parcel-exceptions/{exception_id}','patch',4,'resolve_exception','完成異常處理或記錄退回','resolved：確認問題已處理，恢復待領取並更新取件碼。returned：已實際退回物流，包裹改為 returned。保存處理說明，不能刪除歷史紀錄。',M,'ParcelException','ExceptionResolve',extra_errors=[409])
op('/api/pickups','get',5,'list_pickups','查詢領取紀錄','管理員查看所屬大樓。有效住戶查看有權限的本戶紀錄，包含簽收帳號名稱；搬離後不得查看原戶紀錄。',M+R,'PickupPage',params=pagination+[query('building_id',integer()),query('unit_id',integer(501)),query('date_from',string('2026-10-01',format='date')),query('date_to',string('2026-10-08',format='date'))])
op('/api/pickup-verifications','post',5,'create_pickup_verification','驗證取件碼','在指定大樓內查找唯一且未使用的有效碼。驗證成功建立等待確認紀錄，驗證期限暫定 10 分鐘。包裹仍是 pending，碼此時尚未失效。每件包裹僅允許一個有效驗證；同一管理員重試回傳既有紀錄，不同管理員遇到進行中的驗證回傳 409。',M,'PickupVerification','VerificationCreate',extra_errors=[400,409,429])
op('/api/pickup-verifications/{verification_id}','get',5,'get_pickup_verification','查詢取件進度','僅經手管理員或有該包裹資格的住戶能查詢。可供畫面輪詢等待簽收，不回傳取件碼。',M+R,'PickupVerification')
op('/api/pickup-verifications/{verification_id}/confirm','post',5,'confirm_pickup','住戶確認收到包裹','無需 request body。簽收者只取自登入帳號。重新檢查住戶資格、包裹可見範圍、驗證期限及包裹狀態。同一交易完成：建立唯一簽收紀錄、包裹改 picked_up、取件碼失效、驗證改 completed。同一簽收者重試回傳既有結果；其他人重複確認回傳 409。過期回傳 410，需管理員重新驗證。',R,'Pickup',extra_errors=[409,410])
op('/api/pickup-verifications/{verification_id}/cancel','post',5,'cancel_pickup_verification','取消本次驗證','經手管理員可取消尚未完成的取件驗證；包裹仍待領取。已完成簽收不得取消。',M,'PickupVerification',extra_errors=[409])

# Apply the confirmed database contract. API-only display fields are joins or derived values.
def amend(path, method, description):
    item = paths[path][method]
    item['description'] = item['description'].split('\n\n', 1)[0] + '\n\n' + description

def rename_field(schema, old, new):
    item = schemas[schema]
    if old in item['properties']:
        item['properties'][new] = item['properties'].pop(old)
        item['required'] = [new if key == old else key for key in item.get('required', [])]

for schema in schemas.values():
    for field in ('name', 'recipient_name', 'user_name', 'confirmed_by_name'):
        if field in schema.get('properties', {}): schema['properties'][field]['maxLength'] = 100
schemas['User']['properties'].update(is_active={'type':'boolean','example':True}, updated_at=dt())
schemas['User']['required'] += ['is_active', 'updated_at']
schemas['User']['properties']['role']['example'] = 'resident'
for key in ('Building', 'BuildingCreate', 'BuildingUpdate'):
    schemas[key]['properties']['phone'] = {**phone(), 'nullable':True}
    schemas[key]['properties']['address']['maxLength'] = 255
schemas['Building']['properties']['can_delete'] = {'type':'boolean','description':'目前帳號為系統管理員且大樓無管理員分配、戶別及業務紀錄時為 true；刪除時仍須重新檢查。'}
schemas['Building']['required'].append('can_delete')
schemas['Building']['properties']['updated_at'] = dt()
schemas['Building']['required'].append('updated_at')
for key in ('Unit','UnitCreate','UnitUpdate'):
    schemas[key]['properties']['unit_number']['maxLength'] = 20
schemas['Unit']['properties'].update(created_at=dt(), updated_at=dt())
schemas['Unit']['required'] += ['created_at', 'updated_at']
schemas['BuildingAdmin']['properties'].update(id=integer(3),created_at=dt())
schemas['BuildingAdmin']['required'] += ['id','created_at']

add('Occupancy', {'id':integer(7),'unit_id':integer(501),'started_at':dt(),'ended_at':nullable_dt(),'created_at':dt()})
page('OccupancyPage','Occupancy')
add('InviteCode', {'id':integer(21),'occupancy_id':integer(7),'status':enum(['active','expired','inactive']), 'expires_at':string('2026-10-15T10:30:00+08:00',format='date-time'),'disabled_at':nullable_dt(),'created_by':integer(8),'created_at':dt()})
schemas['InviteCode']['description']='不含原始碼或雜湊。status 是由停用時間、到期時間、批次是否結束推導的 API 欄位。'
schemas['InviteCodeCreated']={'allOf':[ref('InviteCode'),obj({'code':string('0382',pattern='^[0-9]{4}$',description='只在成功產生時顯示一次；清單和後續查詢不回傳。')})]}
schemas['InviteCodeCreate']['properties']['expires_at']=string('2026-10-15T10:30:00+08:00',format='date-time')
for key in ('InvitationVerified','Membership','Parcel','Pickup'):
    schemas[key]['properties']['occupancy_id']=integer(7)
    schemas[key]['required'].append('occupancy_id')
schemas['Membership']['properties'].update(exit_requested_at=nullable_dt(),revoked_by={'type':'integer','nullable':True,'example':None})
schemas['Membership']['required'] += ['exit_requested_at','revoked_by']
# No reason fields were adopted in the membership table.
schemas.pop('ExitRequest')
schemas.pop('MembershipRevoke')
paths['/api/unit-memberships/{membership_id}/exit-request']['post'].pop('requestBody',None)
paths['/api/unit-memberships/{membership_id}/revoke']['post'].pop('requestBody',None)

for key in ('Parcel','ParcelCreate','ParcelUpdate','PickupVerification','Pickup'):
    rename_field(key,'carrier','courier')
rename_field('Parcel','arrived_at','created_at')
rename_field('Pickup','confirmed_by','picked_up_by')
rename_field('Pickup','confirmed_by_name','picked_up_by_name')
rename_field('Pickup','confirmed_at','picked_up_at')
for key in ('ParcelCreate','ParcelUpdate'):
    rename_field(key,'unit_id','occupancy_id')
    schemas[key]['properties']['occupancy_id']=integer(7)
    schemas[key]['properties'].update(courier=string('黑貓宅急便',maxLength=100,nullable=True),tracking_number=string('TC26007128',maxLength=100,nullable=True),storage_location=string('A 架第 2 層',maxLength=100,nullable=True),note=string('外箱完整',nullable=True))
schemas['ParcelCreate']['required']=['occupancy_id','recipient_name']
schemas['Parcel']['properties'].update(courier=string('黑貓宅急便',nullable=True),tracking_number=string('TC26007128',nullable=True),storage_location=string('A 架第 2 層',nullable=True),note=string('外箱完整',nullable=True),updated_at=dt(),exception_reason=string(nullable=True),exception_reported_by={'type':'integer','nullable':True},exception_reported_at=nullable_dt(),resolution_note=string(nullable=True),resolved_by={'type':'integer','nullable':True},resolved_at=nullable_dt())
schemas['Parcel']['required']=list(schemas['Parcel']['properties'])
schemas['Parcel']['description']='大樓、戶別、簽收時間與有效驗證 ID 為關聯／衍生欄位。只保留最近一次異常資料，不回傳取件碼密文。'
schemas['PickupVerification']['properties'].update(updated_at=dt(),courier=string('黑貓宅急便',nullable=True),expires_at=string('2026-10-08T10:40:00+08:00',format='date-time'))
schemas['PickupVerification']['required'].append('updated_at')
schemas['Pickup']['properties']['courier']['nullable']=True
schemas['Pickup']['properties']['tracking_number']['nullable']=True
schemas['Pickup']['description']='簽收者與經手管理員姓名取自簽收當時保存的姓名快照，之後改名不影響歷史；帳號 ID 保留。大樓名稱、樓層、戶號、收件人、單號及物流顯示目前關聯資料，不保存當時快照。'

for obsolete in ('ExceptionCreate','ParcelException','ExceptionPage','ExceptionResolve'):
    schemas.pop(obsolete,None)
paths.pop('/api/parcels/{parcel_id}/exceptions')
paths.pop('/api/parcel-exceptions/{exception_id}')
req('ExceptionReport',{'exception_reason':string('外箱破損，等待處理。',minLength=1)})
req('ExceptionResolution',{'status':enum(['pending','returned']),'resolution_note':string('已實際退回物流。',minLength=1)})
op('/api/parcels/{parcel_id}/exception','put',4,'report_parcel_exception','記錄或更新最近一次異常','只供所屬大樓管理員操作未領取、未退回包裹。填原因後設 exception，記錄操作者與時間、清空前次處理結果，取消未完成取件驗證。同一交易完成；只保留最近一次，不建立獨立異常資料表。',M,'Parcel','ExceptionReport',extra_errors=[409])
op('/api/parcels/{parcel_id}/exception/resolve','post',4,'resolve_parcel_exception','處理最近一次異常','只接受 exception 包裹。pending 表示問題處理完成、恢復領取並更新取件碼；returned 表示已實際退回物流。填處理結果並記錄操作者、時間。入住批次已結束者只允許 returned，不能恢復領取。',M,'Parcel','ExceptionResolution',extra_errors=[409])

paths.pop('/api/units/{unit_id}/invite-codes')
op('/api/units/{unit_id}/occupancies','get',2,'list_occupancies','查看戶別入住批次','管理員只可查看負責大樓內的戶別，包含目前與歷史批次。',M,'OccupancyPage',params=pagination)
op('/api/units/{unit_id}/occupancies','post',2,'create_occupancy','建立入住批次','無需 request body。系統記錄 started_at、created_at；每戶同時間只能有一個有效批次。檢查與建立須在交易中防止並行重複。',M,'Occupancy',status=201,extra_errors=[409])
op('/api/occupancies/{occupancy_id}/end','post',2,'end_occupancy','結束整戶入住','無需 request body。管理員先查詢未領包裹，再確認結束入住。同一交易：填 ended_at、撤銷所有未取消資格、停用邀請碼、取消未完成驗證，待領包裹標為 exception 並填搬離原因與操作者時間；既有異常補充搬離原因。已簽收、已退回者不改狀態。舊包裹保留批次歸屬，後續僅允許異常處理與退回，不允許搬離後領取。重試已結束批次不再覆寫紀錄。',M,'Occupancy')
op('/api/occupancies/{occupancy_id}/invite-codes','get',2,'list_invite_codes','查看邀請碼狀態與期限','只限負責大樓管理員；不回傳原碼或雜湊，顯示目前及歷史邀請碼的狀態、期限。',M,'InviteCodePage',params=pagination)
op('/api/occupancies/{occupancy_id}/invite-codes','post',2,'create_invite_code','產生入住批次邀請碼','有效批次才能產生，期限須在未來。停用批次舊碼與建立新碼在同一交易完成。原碼只在本次成功回應中顯示一次；同戶可多人使用。首次交付給經確認的屋主或入住代表。已加入成員不受影響。',M,'InviteCodeCreated','InviteCodeCreate',201,extra_errors=[409])
op('/api/buildings/{building_id}/admins/{user_id}','delete',1,'unassign_building_admin','取消管理員分配','取消現行分配後立即失去原大樓管理權；保留使用者帳號與過去經手紀錄。更換負責大樓時先取消原分配再指派新大樓。',S,status=204)

amend('/api/buildings/{building_id}/admins','post','建立新管理員或指派既有 building_admin 帳號。一人同時間只能負責一棟大樓；已分配任一大樓時回傳 409。同棟可有多位管理員。')
amend('/api/unit-memberships','post','確認加入時重新檢查：帳號啟用、resident 角色、邀請碼有效、批次未結束。每人只准一筆 active 或 exit_requested 資格；同批次重試回傳既有資格（200），其他戶衝突回傳 409。檢查與建立須防止並行加入兩戶。不接受前端指定 user_id 或 occupancy_id。')
paths['/api/unit-memberships']['post']['responses']['200']={'description':'已加入同批次，回傳既有資格。','content':{'application/json':{'schema':ref('Membership')}}}
amend('/api/unit-memberships/{membership_id}/revoke','post','無需 request body。取消資格、填 left_at 與 revoked_by，停用該入住批次舊邀請碼，須一起成功或失敗。其他同批次成員資格不變，不結束整戶入住；被取消者不得查詢或簽收。重試回傳既有結果，不再次覆寫或停用後來的新碼。')
amend('/api/parcels','get','管理員只看負責大樓；住戶只能看其有效資格、未結束批次內的包裹，同批次晚加入成員也可查看。不能只用 joined_at 過濾。搬離者與新批次住戶無權查看舊批次。排序 created_at 由新到舊，再按 id 由大到小。')
amend('/api/parcels','post','傳入 occupancy_id，確認批次有效及管理員負責其大樓。管理員須核對收件人，不可只按戶號自動分配給新住戶。登記者與時間由系統取得，建立 pending 包裹並產生取件碼。物流、單號、位置、備註選填；回應不包含取件碼。')
amend('/api/parcels/{parcel_id}','patch','只更正 pending 或 exception 包裹；不可直接改 status、簽收者或登記時間。修正 occupancy_id 僅限同大樓有效批次且確認為登記錯誤，取消舊驗證並更換取件碼。來源批次已結束的包裹不得轉移給新住戶或恢復領取，須以異常流程退回。')
amend('/api/pickups','get','管理員可查所屬大樓的歷史簽收。住戶只看有效資格所屬、尚未結束批次的簽收紀錄，晚加入的同批次家人可查看；已搬離或新批次不可看舊資料。顯示簽收當時保存的簽收者及經手管理員姓名。')
for path in ('/api/parcels','/api/pickups','/api/buildings/{building_id}/memberships'):
    paths[path]['get']['parameters'].append(query('occupancy_id',integer(7),'依入住批次篩選，不擴大權限。'))
amend('/api/pickup-verifications','post','檢查帳號啟用、大樓管理權、唯一有效取件碼、包裹 pending、入住批次有效。建立 10 分鐘驗證，包裹仍待領取，碼尚未失效。同包裹只有一筆有效驗證；同管理員重試回傳既有結果，另一管理員遇有效驗證回傳 409。過期需重新核對現場狀況再驗證。')
amend('/api/pickup-verifications/{verification_id}/confirm','post','無需 request body。先檢查當下登入帳號啟用、resident、有效資格及未結束批次，資格批次須與包裹相同。新簽收再檢查驗證 awaiting_confirmation、未過期與包裹 pending。同一交易完成唯一簽收、保存簽收者及經手管理員當時姓名、包裹 picked_up、驗證 completed，使碼失效。簽收者取自登入帳號、時間由系統取得。驗證和簽收的 parcel_id 必須一致。同一簽收者在仍具存取權時重試回傳原成功結果；另一同戶成員回傳 409（已簽收）；已失去資格回傳 403。並行確認只能成功一次。未完成驗證過期回傳 410，須重新確認現場情況後再驗證。')
amend('/api/auth/login','post','驗證 Email、密碼及 is_active；停用帳號不可登入。回傳使用者並以 HttpOnly Cookie 建立登入，不回傳密碼或 JWT。')

# 2026-10-10 Q-01～Q-10 已確認決議；只更新設計契約，尚未實作服務。
schemas.pop('InviteCodeCreate', None)
invite_create = paths['/api/occupancies/{occupancy_id}/invite-codes']['post']
invite_create.pop('requestBody', None)
amend('/api/occupancies/{occupancy_id}/invite-codes','post','無需 request body，不接受管理員自訂期限。系統產生四位數字字串（含開頭0），全系統有效碼唯一；expires_at 固定為 created_at 加24小時。有效入住才能產生；停用舊碼、建立新碼與唯一檢查一起成功或失敗。原碼只在成功回應顯示一次；可提早停用或重發，同戶多人使用，既有成員不受影響。碼空間不足時回傳409且保留原有效碼。')
schemas['InviteCode']['properties']['expires_at'] = string('2026-10-09T10:30:00+08:00', format='date-time', description='固定為created_at加24小時，由後端產生。')
schemas['Pickup']['properties'].update(building_name=string('森光花園'), floor=string('5'), recipient_name=name())
schemas['Pickup']['required'] += ['building_name','floor','recipient_name']
rate_note='同一帳號對此類碼連續失敗5次，暫停對應驗證功能5分鐘，回傳429與Retry-After；不暫停其他功能或其他帳號。邀請碼驗證與確認加入共用失敗計數，取件碼另計。'
for path in ('/api/unit-invitations/verify','/api/unit-memberships','/api/pickup-verifications'):
    paths[path]['post']['description'] += '\n\n' + rate_note
paths['/api/unit-memberships']['post']['description'] += '\n已取消資格者取得新有效碼且無其他有效資格可建立新紀錄；保留舊資格，不增加封鎖名單。'
amend('/api/auth/login','post','驗證Email、密碼與帳號啟用；HttpOnly Cookie登入自成功起8小時有效，到期重新登入。各裝置獨立，不回傳密碼或JWT。')
login['responses']['200']['headers']['Set-Cookie']['description'] += ' Max-Age=28800；後端也需驗證8小時絕對期限。'
login['responses']['200']['headers']['Set-Cookie']['schema']['example']='access_token=<token>; Max-Age=28800; Path=/; HttpOnly; Secure; SameSite=Lax'
amend('/api/auth/logout','post','使目前裝置當次登入在後端失效並清除Cookie；其他裝置不受影響。重複登出仍成功，不可只清除前端Cookie卻保留可用的原憑證。')
# 全域管理員列表供畫面選人，保留既有依大樓查詢及分配API。
add('AdminDirectoryEntry', {'user_id':integer(8), 'name':name(), 'building_id':{'type':'integer','minimum':1,'nullable':True,'example':None}, 'building_name':string('森光花園',nullable=True)})
page('AdminDirectoryPage','AdminDirectoryEntry')
op('/api/building-admins','get',1,'list_admin_directory','查看所有大樓管理員','只供系統管理員的管理員管理畫面使用，包含已分配與未分配的building_admin帳號。操作者選姓名與大樓，前端保存並傳送user_id，不要求使用者輸入ID或Email。調任沿用先取消原分配再指派新大樓；第二步失敗需顯示未分配狀態並可重試，不能顯示調任成功。',S,'AdminDirectoryPage',params=pagination)
# 提醒後明確確認新增，不能以資料庫唯一限制禁止相同單號。
schemas['ParcelCreate']['properties']['duplicate_confirmed']={'type':'boolean','default':False,'description':'管理員看過同棟相同物流與單號的既有紀錄並確認後才送true；不是一般表單預設值，不擴大權限。'}
add('DuplicateParcelWarning', {'code':enum(['DUPLICATE_PARCEL_CONFIRMATION_REQUIRED']), 'message':string('已有相同物流公司與單號，請核對後確認是否新增。'), 'existing_parcels':array(ref('Parcel'))})
paths['/api/parcels']['post']['responses']['409']={'description':'疑似重複需確認，或其他資源狀態衝突。未確認時不得新增；前端先顯示existing_parcels再由管理員確認重送。','content':{'application/json':{'schema':{'oneOf':[ref('DuplicateParcelWarning'),ref('Error')]}}}}
paths['/api/parcels']['post']['description'] += '\n同棟物流公司與單號均有值時比對既有包裹，不以狀態排除；遇相同資料且duplicate_confirmed不是true，回傳409及既有紀錄。管理員核對確認後重送可新增；缺任一值不比對。'
paths['/api/parcels/{parcel_id}']['patch']['description'] += '\n任何資料實際變動均在同一交易取消等待中的驗證；需重新核對再驗證。更改入住歸屬時換取件碼，其他更正保留碼。'
paths['/api/pickup-verifications/{verification_id}/confirm']['post']['description'] += '\n只由住戶本人確認，管理員不得代簽。現場未確認先留櫃檯；已交付未簽收先記錄異常並聯絡核對，恢復流程後仍由有資格的住戶確認，不能繞過入住或資格限制。'
paths['/api/parcels/{parcel_id}/exception']['put']['description'] += '\n已交付但住戶未完成電子簽收時，可在既有異常原因中記錄並追蹤，不代表已完成簽收。'

# 2A 已實作的來源驗證與帳號防濫用；與 Q-05 邀請／取件碼限流分開。
for auth_path in ('/api/auth/register', '/api/auth/login', '/api/auth/logout'):
    paths[auth_path]['post']['responses']['403'] = {'$ref': '#/components/responses/Error403'}
    paths[auth_path]['post']['description'] += '\n寫入請求須攜帶允許的 Origin；缺少、null 或不受信任來源回傳 403。'
paths['/api/auth/login']['post']['description'] += '\n登入依來源 IP 與正規化 Email 分別限制每 5 分鐘 20 次（含成功），超限回傳 429 與 Retry-After。'
paths['/api/auth/register']['post']['description'] += '\n註冊依來源 IP 與正規化 Email 分別限制每小時 10 次（含成功），超限回傳 429 與 Retry-After。'
paths['/api/users/me']['patch']['description'] += '\n寫入請求須攜帶允許的 Origin；缺少或不受信任來源回傳 403。'
paths['/api/users/me']['get']['description'] += '\n2B／2D 已接上實際查詢：memberships 只包含本人尚未結束入住的 active／exit_requested 資格；managed_building_ids 為目前管理分配。空陣列代表當下沒有對應關聯。'

error_names={400:('INVALID_CODE','邀請碼或取件碼無效。'),401:('UNAUTHENTICATED','請先登入，或帳號密碼不正確。'),403:('FORBIDDEN','你沒有權限執行此操作。'),404:('NOT_FOUND','找不到資料。'),409:('CONFLICT','資料重複，或目前狀態不允許此操作。'),410:('VERIFICATION_EXPIRED','取件驗證已過期，請重新驗證。'),422:('VALIDATION_ERROR','輸入資料格式不正確。'),429:('TOO_MANY_REQUESTS','嘗試次數過多，請稍後再試。'),500:('INTERNAL_ERROR','系統暫時無法完成操作。')}
responses={f'Error{c}':{'description':m,'content':{'application/json':{'schema':ref('Error'),'example':{'code':n,'message':m}}}} for c,(n,m) in error_names.items()}
responses['Error429']['headers']={'Retry-After':{'description':'距離可重試的剩餘秒數。','schema':{'type':'integer','minimum':0}}}

description='''大樓包裹管理系統 API 規格。**40 個後端操作；各項實作與驗收證據見開發計畫；2A 以外的前端及整體串接待完成。依 D-26 先完成 DB／後端；進度以 development-plan.md 為準。**

依 docs/business-rules.md 與 docs/open-questions.md 開發；第一階段確認規則，第二階段基本功能，第三階段主要功能。Q-01～Q-10已確認，見 docs/decisions.md；後續技術方案仍按T清單驗證。

## 使用流程
1. 註冊 → 登入 → 驗證戶別邀請碼 → 確認加入戶別。
2. 管理員登記包裹 → 住戶查看取件碼 → 管理員驗證 → 住戶收到實物後確認 → 取件碼失效。
3. 住戶退出申請 → 管理員確認搬離 → 取消資格並停用舊邀請碼。

## 已確認的功能規則
- 角色：system_admin / building_admin / resident；大樓範圍與住戶資格每次由後端檢查，不能只相信 JWT 內的舊資格。
- 每位住戶同時只有一個有效戶別；退出申請中仍算有效，取消後失去所有原戶資料權限。
- 同戶同入住批次成員共同查看包裹；晚加入的家人也可查看。新批次住戶與已搬離者不能看舊資料，不以 joined_at 作為唯一過濾條件。
- 管理員驗證不等於領取完成。驗證 10 分鐘有效；住戶確認成功後才保存簽收、使碼失效。重複與並行確認不能產生兩筆簽收。
- 每戶同時間只有一個有效入住批次。整戶搬離時一起結束批次、撤銷資格、停用邀請碼、取消驗證並將未領包裹列為異常。舊批次包裹只處理退回，不提供搬離後領取。
- 邀請碼只在產生時回傳原碼一次，之後只看期限與狀態。有效期間可供同批次多人使用，重新產生停用舊碼。
- 異常只記錄最近一次，存在包裹資料內，沒有獨立異常歷程表。
- 一位大樓管理員同時間只管理一棟大樓，同棟可有多位管理員。

## API 契約與已確認碼規則
- 清單採 page / page_size，回傳 items / total / page / page_size；時間用含時區的 ISO 8601。
- 邀請碼四位數、全系統有效碼唯一、固定24小時；取件碼六位數、同棟有效碼唯一，均為字串。兩種碼各連錯5次，暫停該帳號對應驗證5分鐘。

## 登入及安全
使用 access_token HttpOnly Cookie。正式環境需 HTTPS、Secure、SameSite 和狀態變更請求的 CSRF／Origin 防護。Cookie 名稱為本草案預設。Swagger 預覽關閉 Try it out，避免對尚未存在的服務送出請求。每個受保護請求都重新檢查帳號啟用與當下權限。

## 前端同步
包裹詳情提供 active_verification_id。住戶與經手管理員可查驗證進度；第一版可輪詢，未宣稱已具備即時推送。

## 補充
本規格的統一錯誤格式需在 FastAPI 中實作對應例外處理；不是 FastAPI 預設 validation 回應。邀請碼存雜湊，取件碼存加密資料，但皆不回傳保存值。一般顯示資訊可由關聯取得；簽收者與經手管理員姓名須保存簽收當時快照。加密與雜湊的查找、唯一限制與交易實作仍須依資料庫設計文件核對。
'''
spec={'openapi':'3.0.3','info':{'title':'寓收｜大樓包裹管理系統 API','version':'0.4.0-draft','description':description},'servers':[{'url':'http://localhost:8001','description':'本機 FastAPI（40 個業務操作）'}],'tags':[{'name':n} for n in tag_names],'security':[{'cookieAuth':[]}],'paths':paths,'components':{'securitySchemes':{'cookieAuth':{'type':'apiKey','in':'cookie','name':'access_token','description':'登入由伺服器設定 HttpOnly Cookie，前端不自行指定簽收者。'}},'schemas':schemas,'responses':responses}}

# Validate the locally generated contract: every reference, unique operation ID,
# path parameter declaration and response schema must resolve before delivery.
def walk(v):
    if isinstance(v,dict):
        if '$ref' in v:
            target=spec
            for part in v['$ref'][2:].split('/'): target=target[part]
        for item in v.values():walk(item)
    elif isinstance(v,list):
        for item in v:walk(item)
walk(spec)
ids=[]
for path,methods in paths.items():
    for method,o in methods.items():
        ids.append(o['operationId'])
        expected=set(re.findall(r'{(.*?)}',path))
        actual={p['name'] for p in o.get('parameters',[]) if p['in']=='path' and p['required']}
        assert expected==actual,(path,expected,actual)
        assert o['responses']
assert len(ids)==len(set(ids))

phase_map = json.loads((OUT/'development-phases.json').read_text(encoding='utf-8'))
phase_ids = [ident for group in phase_map.values() for ident in group]
assert len(phase_ids) == len(set(phase_ids)) and set(phase_ids) == set(ids), 'Phase coverage mismatch'
for methods in paths.values():
    for operation_data in methods.values():
        phase = next(number for number, group in phase_map.items() if operation_data['operationId'] in group)
        operation_data['x-development-phase'] = int(phase)
        operation_data['description'] = '**開發階段：第 ' + phase + ' 階段**\n\n' + operation_data['description']

raw=json.dumps(spec,ensure_ascii=False,indent=2)
(OUT/'openapi.json').write_text(raw,encoding='utf-8')
# 後端回應驗證使用相同契約；不複製第二套欄位定義。
(OUT.parent.parent/'backend/app/schemas/contract.json').write_text(json.dumps(schemas,ensure_ascii=False,indent=2),encoding='utf-8')
(OUT.parent.parent/'backend/app/contract_operations.json').write_text(json.dumps({p:{m:{k:o[k] for k in ('operationId','summary','description','tags')} for m,o in methods.items()} for p,methods in paths.items()},ensure_ascii=False,indent=2),encoding='utf-8')
def scalar(v): return json.dumps(v,ensure_ascii=False)
def yaml_lines(v,indent=0):
    pad=' '*indent
    if isinstance(v,dict) and v:
        for k,val in v.items():
            if isinstance(val,(dict,list)) and val:
                yield pad+scalar(k)+':'
                yield from yaml_lines(val,indent+2)
            else:yield pad+scalar(k)+': '+scalar(val)
    elif isinstance(v,list) and v:
        for val in v:
            if isinstance(val,(dict,list)) and val:
                yield pad+'-'
                yield from yaml_lines(val,indent+2)
            else:yield pad+'- '+scalar(val)
(OUT/'openapi.yaml').write_text('\n'.join(yaml_lines(spec))+'\n',encoding='utf-8')
html='''<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>寓收 API · Swagger</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui.css">
<style>body{margin:0;background:#fafcfc;font-family:system-ui,"Microsoft JhengHei",sans-serif}.banner{background:#155e55;color:white;padding:18px 28px;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}.banner strong{font-size:18px}.banner small{display:block;margin-top:4px;color:#d6ece7}.banner button{background:white;color:#155e55;border:0;border-radius:6px;padding:9px 14px;cursor:pointer}.swagger-ui .wrapper{max-width:1180px}.swagger-ui .info{margin:30px 0}.swagger-ui .opblock-summary-description,.swagger-ui .markdown{font-family:system-ui,"Microsoft JhengHei",sans-serif}#fallback{padding:24px;max-width:1120px;margin:auto;color:#334155}#fallback details{padding:12px;border-bottom:1px solid #dce4e8}#fallback summary{cursor:pointer}#fallback pre{overflow:auto;font-size:12px}.error{color:#9b3535}</style></head><body>
<div class="banner"><div><strong>寓收 · API 規格預覽</strong><small>設計草案 · 六組功能 · 尚未連接後端，未開放發送請求</small></div><button id="download">下載 OpenAPI JSON</button></div>
<div id="swagger-ui"></div><div id="fallback"><p>正在載入 Swagger UI。首次開啟需要網路；下方提供離線規格摘要。</p></div>
<script id="spec" type="application/json">__SPEC__</script>
<script>
const spec=JSON.parse(document.getElementById('spec').textContent);
const fallback=document.getElementById('fallback');
for(const tag of spec.tags){const section=document.createElement('section');const h=document.createElement('h2');h.textContent=tag.name;section.append(h);for(const [path,methods] of Object.entries(spec.paths)){for(const [method,op] of Object.entries(methods)){if(!op.tags.includes(tag.name))continue;const d=document.createElement('details'),s=document.createElement('summary'),p=document.createElement('p'),pre=document.createElement('pre');s.textContent=method.toUpperCase()+' '+path+' — '+op.summary;p.textContent=op.description;pre.textContent=JSON.stringify(op,null,2);d.append(s,p,pre);section.append(d)}}fallback.append(section)}
document.getElementById('download').onclick=()=>{const u=URL.createObjectURL(new Blob([JSON.stringify(spec,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='openapi.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
function showSwagger(){if(!window.SwaggerUIBundle)return;window.ui=SwaggerUIBundle({spec,dom_id:'#swagger-ui',deepLinking:true,filter:true,docExpansion:'list',displayRequestDuration:false,defaultModelsExpandDepth:-1,supportedSubmitMethods:[],validatorUrl:null,presets:[SwaggerUIBundle.presets.apis],onComplete:()=>{fallback.hidden=true}})}
</script><script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js" onload="showSwagger()" onerror="document.querySelector('#fallback p').textContent='Swagger UI 未能載入。以下是可離線查看的 API 摘要；完整規格也可下載。'"></script></body></html>'''
(OUT/'swagger.html').write_text(html.replace('__SPEC__',raw.replace('<','\\u003c')),encoding='utf-8')
print(json.dumps({'operations':len(ids),'paths':len(paths),'schemas':len(schemas),'references':'all resolved','files':['swagger.html','openapi.json','openapi.yaml']},ensure_ascii=False))
