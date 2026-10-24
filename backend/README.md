# 後端閱讀與測試

這個後端沿用 FastAPI、Pydantic 與 MySQL。先看一個功能如何從 HTTP 走到資料庫，再看其他功能，不必先理解整個專案。

## 建議閱讀順序

1. `app/main.py`：註冊路由、來源檢查和錯誤處理。
2. `app/routers/domain.py`：例如 `create_building`，接收已驗證輸入，開啟交易，再呼叫服務。
3. `app/schemas/domain.py`：輸入允許哪些欄位、長度和狀態；不接受多餘欄位。
4. `app/services/buildings.py`：以大樓功能為例，查權限、執行 SQL、回傳結果；其他功能各自放在對應服務。
5. `app/schemas/outputs.py`：明確列出對外回應欄位，排除密碼雜湊與碼密文。這裡使用一般 Python 類別，不會在啟動時動態建立型別。
6. `app/migrations/`：按編號建表。已套用的 migration 不修改，後續升級新增下一個檔案。

帳號的既有程式分成 `routers/auth.py`、`services/auth.py` 與 `repositories/`。其餘業務按功能拆分，在對應服務執行參數化 SQL。所有 SQL 值使用參數，不拼接使用者輸入。

## 業務服務位置

以下檔案位於 `app/services/`：

| 檔案 | 負責內容 |
| --- | --- |
| `buildings.py`、`building_admins.py` | 大樓、管理員分配 |
| `units.py`、`occupancies.py` | 戶別、入住批次與結束入住 |
| `invitations.py`、`memberships.py` | 邀請碼、加入、退出與住戶資格 |
| `parcels.py` | 包裹登記、查詢、修改與領取碼 |
| `pickups.py` | 領取驗證、住戶簽收及領取紀錄 |
| `exceptions.py` | 包裹異常處理 |
| `permissions.py`、`code_attempts.py` | 共用權限、驗碼失敗次數與鎖定 |
| `base.py`、`common.py` | SQL 工具、分頁、時間與錯誤回應 |
| `context.py`、`transactions.py` | 組合服務、共用交易與資料庫鎖 |

例如：路由呼叫 `services.occupancies.end_occupancy(...)`，入住服務再透過 `self.context.pickups.cancel_waiting(...)` 取消等待中的領取驗證。跨服務呼叫仍使用同一條資料庫連線，不另開交易。

## 交易怎麼運作

路由的 `with transaction(user)` 會取得該資料庫的業務鎖、重新查帳號、執行服務，最後成功就 commit，失敗就 rollback，並釋放鎖。分配、加入、簽收、搬離都遵循同一流程，方便檢查跨資料表變更是否一起完成。

這是以容易理解與資料一致性為優先的本機 MVP；同資料庫業務操作會依序進行。清單也先依權限取資料再篩選與分頁，沒有為大量資料加入快取或額外架構。

錯碼驗證是特例：必須記住失敗次數，所以服務會先保存計數，再回傳錯誤。這個階段尚未修改包裹或入住等業務資料。

## 可重跑測試

以下在**專案根目錄** PowerShell 執行，使用既有 Docker 環境與獨立測試庫：

```powershell
docker compose exec -T -e DB_NAME=parcel_management_test backend python -m app.acceptance_2a
docker compose exec -T -e DB_NAME=parcel_management_test backend python -m app.acceptance_domain
docker compose run --rm -T --no-deps -v "${PWD}/backend:/app" backend python -m unittest discover -s tests -v
python -X utf8 backend/database_recovery.py
```

- `acceptance_2a.py`：帳號、Cookie、資料修改、登入失效與限流。
- `acceptance_domain.py`：40 操作的實際 HTTP 呼叫、資料隔離、狀態變化、並行與故障回滾。只接受固定測試庫名稱，保留測試紀錄。
- `tests/`：啟動失敗、備份工具安全邊界、24 個回應類別與契約一致性、秘密欄位排除、UTC 格式，以及跨服務共用交易、失敗回滾與鎖釋放。使用容器的依賴執行，不必在 Windows 安裝後端套件。
- `database_recovery.py`：完整 SQL 匯出、還原到新庫、資料比較；加入 `--restart-mysql` 可驗證重啟保存，但本機 API 會短暫無法連線。

兩組整合驗收與備份比較不要同時執行，避免互相修改測試庫。不得將測試庫名稱改成開發庫執行。真實資料操作與金鑰說明見 `docs/docker-development.md`。

## 修改 API 時

先依商業規則確認行為，再同步 `docs/swagger/build_spec.py`、輸入／回應類別、服務及測試。執行 Swagger 產生腳本更新契約快照；`test_output_contract.py` 會檢查手寫回應與快照一致，不能只改其中一邊。`docs/development-plan.md` 由人工更新驗收證據。

- `acceptance_building_delete.py`：D-27 住戶角色與刪除／分配並行驗收；只接受 `parcel_management_test`，先執行完整 domain 驗收初始化。
