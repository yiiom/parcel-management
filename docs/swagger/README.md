# Swagger API 規格草案

版本：0.4.0-draft。商業規則依 [商業邏輯](../business-rules.md)，決議及技術待辦見 [確認清單](../open-questions.md)。40 個後端操作已實作；規格本身不作為驗收證據，測試結果見開發計畫。

## 檔案與維護

- `build_spec.py`：產生 OpenAPI JSON、YAML 與 Swagger 預覽的來源。
- `development-phases.json`：操作與三大開發階段對照；階段 1 沒有 API，階段 2 有 25 個，階段 3 有 15 個。
- `operation-features.json`：操作與 F-01～F-13 功能對照。
- `build_development_plan.py`：驗證階段與功能完整覆蓋，產生 `api-checklist.md`，不再覆蓋人工開發計畫。
- `openapi.json`、`openapi.yaml`、`swagger.html`、`api-checklist.md`：生成結果，修改來源後重新產生。

目前共 40 個 API 操作、30 個路徑；後續需求決議若增加操作，需同步計數及對照。實際進度只記錄在 [開發順序與驗收](../development-plan.md)。

## 已同步的決議

- 使用三階段：規則文件 → 基本功能 → 主要功能與本機驗收。
- `Pickup.picked_up_by_name` 與 `Pickup.handled_by_name` 代表簽收當時保存的姓名快照，不再讀取使用者目前姓名。
- 其餘大樓名稱、樓層、戶號、收件人、物流及單號依Q-10使用目前關聯值。Q-01～Q-10已全部確認。
- 入住隔離、邀請碼只顯示一次、搬離交易、驗證不等於簽收及只保留最近異常等既有規則維持。

## 重新產生

在專案根目錄執行：

```powershell
python docs/swagger/build_spec.py
python docs/swagger/build_development_plan.py
```

腳本檢查引用、operationId、路徑參數及功能／階段覆蓋，不代表完整 OpenAPI 驗證或後端測試。Swagger 預覽關閉 Try it out，載入失敗提供離線摘要。

後端本機 Docker 入口預設為 http://localhost:8001；`/docs` 由實際路由與模型產生，本目錄保存共同 API 契約。

## 與資料庫的區別

關聯與計算資訊不一定另存欄位；簽收姓名快照是已確認需要保存的例外。密碼雜湊、邀請碼雜湊及取件碼密文不得回傳。索引、加密查找及交易細節見資料庫設計與 T 清單，實作前補齊。

## 本次契約變更

- 新增 `GET /api/building-admins`：系統管理員取得包含未分配帳號的管理員列表，畫面顯示姓名與大樓，背景使用user_id。
- 邀請碼輸入改四位數字字串；產生邀請碼不需request body，刪除自訂expires_at輸入，固定24小時。
- 登入固定8小時，目前裝置登出須撤銷當次登入；兩種碼分別連錯5次暫停5分鐘，邀請碼兩入口共用計數。
- 新增包裹的duplicate_confirmed預設false；疑似重複回傳409及existing_parcels，明確確認後可新增，並非禁止重複。
- 包裹更正有實際變動即取消原驗證，只有改入住時因本次更正換碼。
- 簽收回傳補上目前大樓名稱、樓層與收件人；僅兩個姓名使用快照。
- 上述契約已有對應業務 API；前端與整體串接進度仍以開發計畫為準。

## 回應模型一致性測試

`build_spec.py` 同時產生 `backend/app/schemas/contract.json` 作為測試用契約快照，以及 `backend/app/contract_operations.json` 提供 Swagger 中文說明。回應類別明確寫在 `backend/app/schemas/outputs.py`，不在執行時解析 JSON 建立型別；`backend/tests/test_output_contract.py` 比對 24 個類別的欄位、必填、型別與限制。
