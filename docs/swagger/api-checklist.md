# API 功能與階段對照

本檔自動產生，只記錄規格對照，不記錄完成狀態。實際進度見 [開發順序與驗收](../development-plan.md)。

第一階段為規則與文件，沒有業務 API 實作。第二階段為基本功能，第三階段為主要功能。

Q-01～Q-10已確認；決議及技術待辦見 [確認清單](../open-questions.md)。

## 第 1 階段 共 0 個操作

確認規則與文件。

## 第 2 階段 共 24 個操作

| 功能 | 方法與路徑 | 操作 | operationId |
|---|---|---|---|
| F-01 | `POST /api/auth/register` | 註冊住戶帳號 | `register_resident` |
| F-01 | `POST /api/auth/login` | 登入 | `login` |
| F-01 | `POST /api/auth/logout` | 登出 | `logout` |
| F-01 | `GET /api/users/me` | 取得自己的帳號與資格 | `get_me` |
| F-02 | `PATCH /api/users/me` | 修改個人資料 | `update_me` |
| F-03 | `GET /api/buildings` | 取得可管理的大樓 | `list_buildings` |
| F-03 | `POST /api/buildings` | 建立大樓 | `create_building` |
| F-03 | `GET /api/buildings/{building_id}` | 取得大樓資料 | `get_building` |
| F-03 | `PATCH /api/buildings/{building_id}` | 修改大樓資料 | `update_building` |
| F-04 | `POST /api/buildings/{building_id}/admins` | 建立或指派大樓管理員 | `assign_building_admin` |
| F-04 | `GET /api/buildings/{building_id}/admins` | 查看大樓管理員 | `list_building_admins` |
| F-04 | `DELETE /api/buildings/{building_id}/admins/{user_id}` | 取消管理員分配 | `unassign_building_admin` |
| F-05 | `GET /api/buildings/{building_id}/units` | 查看樓層與戶號 | `list_units` |
| F-05 | `POST /api/buildings/{building_id}/units` | 建立戶別 | `create_unit` |
| F-05 | `PATCH /api/units/{unit_id}` | 更正戶別資料 | `update_unit` |
| F-05 | `GET /api/units/{unit_id}/occupancies` | 查看戶別入住批次 | `list_occupancies` |
| F-05 | `POST /api/units/{unit_id}/occupancies` | 建立入住批次 | `create_occupancy` |
| F-06 | `POST /api/unit-invitations/verify` | 驗證戶別邀請碼 | `verify_unit_invitation` |
| F-06 | `POST /api/unit-memberships` | 確認加入戶別 | `join_unit` |
| F-06 | `GET /api/occupancies/{occupancy_id}/invite-codes` | 查看邀請碼狀態與期限 | `list_invite_codes` |
| F-06 | `POST /api/occupancies/{occupancy_id}/invite-codes` | 產生入住批次邀請碼 | `create_invite_code` |
| F-06 | `POST /api/invite-codes/{code_id}/deactivate` | 停用邀請碼 | `deactivate_invite_code` |
| F-06 | `GET /api/buildings/{building_id}/memberships` | 查看住戶與退出申請 | `list_memberships` |
| F-04 | `GET /api/building-admins` | 查看所有大樓管理員 | `list_admin_directory` |

## 第 3 階段 共 15 個操作

| 功能 | 方法與路徑 | 操作 | operationId |
|---|---|---|---|
| F-07 | `POST /api/parcels` | 登記包裹 | `create_parcel` |
| F-07 | `PATCH /api/parcels/{parcel_id}` | 更正包裹登記資料 | `update_parcel` |
| F-08 | `GET /api/parcels` | 查詢包裹列表 | `list_parcels` |
| F-08 | `GET /api/parcels/{parcel_id}` | 取得包裹詳情 | `get_parcel` |
| F-09 | `GET /api/parcels/{parcel_id}/pickup-code` | 取得包裹取件碼 | `get_pickup_code` |
| F-09 | `POST /api/pickup-verifications` | 驗證取件碼 | `create_pickup_verification` |
| F-09 | `GET /api/pickup-verifications/{verification_id}` | 查詢取件進度 | `get_pickup_verification` |
| F-09 | `POST /api/pickup-verifications/{verification_id}/confirm` | 住戶確認收到包裹 | `confirm_pickup` |
| F-09 | `POST /api/pickup-verifications/{verification_id}/cancel` | 取消本次驗證 | `cancel_pickup_verification` |
| F-10 | `GET /api/pickups` | 查詢領取紀錄 | `list_pickups` |
| F-11 | `PUT /api/parcels/{parcel_id}/exception` | 記錄或更新最近一次異常 | `report_parcel_exception` |
| F-11 | `POST /api/parcels/{parcel_id}/exception/resolve` | 處理最近一次異常 | `resolve_parcel_exception` |
| F-12 | `POST /api/unit-memberships/{membership_id}/exit-request` | 提出退出申請 | `request_exit` |
| F-12 | `POST /api/unit-memberships/{membership_id}/revoke` | 取消搬離住戶資格 | `revoke_membership` |
| F-13 | `POST /api/occupancies/{occupancy_id}/end` | 結束整戶入住 | `end_occupancy` |
