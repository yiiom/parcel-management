# 前端串接交接

更新：2026-10-15，依 D-26。39 個 API 的 DB／後端已完成；目前只將 2A 標為整項完成，其他前端與完整驗收由使用者接續。

## 入口與初始化

- 前端：`http://localhost:3001`；後端：`http://localhost:8001`。
- 實際可執行 Swagger：`http://localhost:8001/docs`；靜態完整契約：`docs/swagger/openapi.json`。
- 原有住戶帳號與資料保留。開發庫未加入驗收用大樓或管理員；測試資料只存在 `parcel_management_test`。
- 首位系統管理員由本人輸入帳密建立，沒有預設管理員密碼。在專案根目錄執行：

```powershell
docker compose exec backend python -m app.bootstrap_admin
```

相同 Email 重跑不改密碼；已有其他系統管理員則拒絕新增。之後從 Swagger 登入該帳號，建立大樓與大樓管理員；前端不需要額外的後端功能才能開始。

## 共通請求

```ts
const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/buildings`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "測試大樓", address: "測試地址", phone: null }),
});
const result = await response.json();
if (!response.ok) throw new Error(result.message ?? "操作失敗，請稍後再試。");
```

- 登入憑證在 HttpOnly Cookie，不從 JSON 讀 token、不存 localStorage。所有需登入的請求使用 `credentials: "include"`。
- 前端與 Swagger 的 Origin 由瀏覽器自動送出；非瀏覽器工具寫入時須帶 `Origin: http://localhost:3001` 或允許的 API 來源。缺少或不允許來源回傳 403。
- 401：登入失效，清除畫面中的登入資料並引導重新登入。403：角色或資料範圍不符，或寫入來源不允許。404：不存在。409：狀態衝突。410：本次取件驗證過期。422：欄位格式、額外欄位或空 PATCH。429：依 `Retry-After` 等待後再試。
- 一般錯誤為 `{code,message,details?}`。不要把任何失敗當成成功；保留表單輸入、恢復按鈕。`204` 沒有 JSON，不呼叫 `response.json()`。
- 清單使用 `page`、`page_size`（1～100），回應 `items/total/page/page_size`；篩選不會擴大權限。包裹依建立時間、ID 由新到舊；簽收依簽收時間、ID 由新到舊。
- 時間為 UTC 的 ISO 8601 含時區字串，前端轉臺灣時間。簽收 `date_from/date_to` 以臺灣日期解讀，含起迄兩日。
- PATCH 只傳修改欄位，至少一個；`null` 只適用可清空的選填欄位。Email／角色／user_id 不可透過個人資料修改。

## 前端建議順序與最小操作

| 順序 | 畫面 | API 與注意事項 |
|---|---|---|
| 2B | 大樓與管理員 | 系統管理員建立大樓、查詢 `/api/building-admins`，選姓名與大樓分配；管理員只看自己的大樓 |
| 2C | 戶別與入住 | 建戶別、建立入住、查歷史；建立入住 POST 不送 body，同戶有效入住唯一 |
| 2D | 邀請碼與加入 | 產生碼不送 body；成功回應的 `code` 只顯示這一次。住戶驗證後顯示戶別，再明確確認加入 |
| 3A | 包裹表單與清單 | 送 `occupancy_id/recipient_name`；其他欄位選填，必須顯示重複警告後才確認重送 |
| 3B | 取件驗證與住戶確認 | 管理員驗碼後交付實物；住戶本人確認。管理員不可代簽。驗證有效 10 分鐘 |
| 3C | 異常與處理 | 原因必填；恢復待領或實際退回須填結果。入住已結束只能退回 |
| 3D | 個別搬離與整戶結束 | 住戶申請、管理員取消；整戶結束前先查 pending／exception 包裹並顯示影響確認 |

建立管理員：`POST /api/buildings/{building_id}/admins`，二選一：

```json
{"name":"管理員姓名","email":"manager@example.com","phone":"0912345678","password":"由使用者設定的密碼"}
```

或 `{"user_id": 8}` 指派既有 building_admin；已分配時回傳 409，調任須先 DELETE 原分配，再 POST 新分配。第二步失敗時顯示未分配，可重試，不能顯示調任成功。

邀請碼驗證／加入都傳 `{"invite_code":"0382"}`，必須保留開頭 0。驗證成功不代表加入；加入首次 201，同批次重試 200。兩者共用連錯計數：連錯 5 次，該帳號暫停邀請驗證 5 分鐘。

`GET /api/users/me` 已回傳真實 `memberships` 與 `managed_building_ids`。後續前端須根據這兩個欄位顯示目前戶別／大樓，不再固定顯示尚未加入／等待分配；原有 2A 首頁屬當時 D-25 範圍，這項調整留給前端製作。

## 重複包裹與取件流程

相同大樓、物流公司及單號遇到既有紀錄時，首次新增回傳 409：

```json
{"code":"DUPLICATE_PARCEL_CONFIRMATION_REQUIRED","message":"已有相同物流公司與單號，請核對後確認是否新增。","existing_parcels":[]}
```

實際 `existing_parcels` 會含既有包裹。先顯示紀錄並讓管理員確認，再使用相同內容加 `duplicate_confirmed:true` 重送；不要預設 true。缺物流或單號不比對。

1. 住戶從 `/api/parcels/{id}/pickup-code` 取得六位字串；一般包裹回應不含碼。
2. 管理員送 `{"building_id":1,"pickup_code":"012345"}` 至 `/api/pickup-verifications`。
3. 保存驗證 `id/expires_at`，輪詢 GET `/api/pickup-verifications/{id}`。建議每 3 秒一次、頁面離開時停止；暫時斷線顯示錯誤與重試，不能自行判定已簽收。
4. 住戶確認實際收到後，POST `/api/pickup-verifications/{id}/confirm`，不送 body。管理員畫面只能等待或取消本次驗證。
5. `completed/expired/cancelled` 停止輪詢；到期再向後端核對狀態。後端為最終依據，10 分鐘不是包裹取件碼期限。

同管理員重試驗碼得到既有等待紀錄；另一管理員遇進行中紀錄得到 409。同簽收者仍有權限時重試確認得到同一筆簽收；其他成員得到 409。資格被撤銷後，即使曾簽收也不能再查原結果。

## 重驗與資料安全

```powershell
docker compose exec -T -e DB_NAME=parcel_management_test backend python -m app.acceptance_2a
docker compose exec -T -e DB_NAME=parcel_management_test backend python -m app.acceptance_domain
```

兩支測試拒絕使用開發庫；保留測試紀錄，會調整測試帳號、期限及限流視窗。完整業務驗收 241 項、2A 回歸 47 項通過。畫面操作、手機版、網路錯誤互動與整體 3E 驗收仍待前端完成。

新電腦先複製 `.env.example`、設定 MySQL 密碼，執行 `python backend/app/configure_local_key.py` 建立碼加密金鑰，再啟動 Compose 與執行 `python -m app.migrate`。不要重產既有金鑰：遺失金鑰會使已加密取件碼無法還原。正式環境須另行配置 `CODE_ENCRYPTION_KEY`、HTTPS 與備份；本次未部署遠端服務。

目前以每個資料庫一把業務交易鎖確保一致性，適合本機 MVP；尚未進行大量資料／高併發效能驗收。未修改或刪除正式／開發住戶資料。

## 2026-10-23 D-27 空白大樓刪除

現行契約為 40 個操作（階段 2：25；階段 3：15）。系統管理員在大樓詳情確認名稱、地址及不可復原提示後，呼叫 `DELETE /api/buildings/{building_id}`，不送 body；204 不解析 JSON，返回列表；401 返回登入；409 顯示有關聯資料不可刪除，404 表示大樓不存在。連線中斷不自動重送，提示返回列表核對。大樓管理員與住戶禁止此操作。

2026-10-23 顯示方式補充（使用者確認）：有管理員分配、戶別或業務紀錄時隱藏整個刪除區塊。Building 回應提供 `can_delete`，只有系統管理員且無關聯資料時為 true；前端仍檢查角色。刪除送出時後端重新檢查同一組條件，不能以先前回應作為刪除授權。刪除失敗後重新查詢狀態，避免繼續顯示過期的刪除入口。
