# Docker 開發環境

在專案根目錄執行下列指令。Docker Desktop 須先啟動，使用 Linux containers。
本設定供本機開發，不是正式部署設定。

## 第一次啟動

本機已準備 `.env` 並產生開發用隨機密碼；不要提交此檔。
新電腦請複製 `.env.example` 為 `.env`，設定兩組不同密碼。
再執行 `python backend/app/configure_local_key.py` 產生碼加密金鑰；已有金鑰不會覆寫。

```powershell
docker compose up --build -d
docker compose ps
```

| 服務 | 網址或連線方式 |
|---|---|
| Next.js 前端 | http://localhost:3001 |
| FastAPI 環境檢查 | http://localhost:8001/health |
| FastAPI 實際 API 文件 | http://localhost:8001/docs |
| Workbench | Host: 127.0.0.1、Port: 3307、User: parcel_app |

Workbench 密碼使用根目錄 `.env` 的 `MYSQL_PASSWORD`，資料庫為 `parcel_management`。
目前已完成 10 張業務表及技術支援表、40 個業務 API。新資料庫啟動後執行 `docker compose exec -T backend python -m app.migrate` 套用 001～013。
`/docs` 是目前實際可呼叫的 API；`docs/swagger` 為同步產生的完整契約。前端交接見 [串接說明](frontend-integration.md)。

## 日常操作

```powershell
# 查看紀錄（Ctrl+C 只離開紀錄畫面）
docker compose logs -f

# 暫停三個服務，保留容器與資料
docker compose stop

# 再次啟動
docker compose up -d

# 程式套件、Dockerfile 或組態檔變更後重新建置
docker compose up --build -d
```

`frontend/src`、`frontend/public`、`backend/app` 直接對應電腦上的檔案，
修改後可由開發伺服器載入。其他檔案（如 package-lock.json、next.config.ts、requirements.txt）修改後須重新建置。
Node 套件與 `.next` 存在容器內，不使用 Windows 的 node_modules。
後端已開啟檔案輪詢；若前端檔案通知未傳入 Docker，先確認 Docker Desktop 檔案共享，再重新啟動前端。

## 連線位置

- 瀏覽器呼叫後端：`http://localhost:8001`（NEXT_PUBLIC_API_URL）。
- 前端伺服器在容器內呼叫後端：`http://backend:8000`（API_INTERNAL_URL）。
- 後端連 MySQL：`mysql:3306`，不是 localhost:3307。
- Workbench 在 Windows 連 MySQL：`127.0.0.1:3307`。
- 若調整連接埠，修改 `.env` 後執行 `docker compose up -d`。

## MySQL 資料保存

MySQL 資料存於 `mysql_data` named volume，停止或重建容器不會自動刪除它。
一般 `docker compose down` 也保留資料；不要加上 `-v`，那會刪除資料 volume。
volume 不是備份，重要資料仍須另外匯出。
首次初始化才套用資料庫名稱、帳號與密碼；已初始化後修改 `.env` 不會自動修改資料庫帳密。
目前沒有自動掛入建表 SQL，以免在資料表實作前執行草案。

## 早期環境驗證（歷史紀錄，後續狀態見開發計畫）

- 三個容器已成功建置並啟動。
- MySQL 與後端容器健康檢查通過。
- 前端首頁與後端 `/docs` 回傳 HTTP 200。
- `/health` 回傳 `status: ok`、`database: connected`，確認後端實際可查詢 MySQL。
- 沿用原前端鎖檔；安裝時 npm 回報 5 項 high severity 套件弱點，尚未逐項審查或升級，正式部署前需另行處理。
- 檔案掛載已設定；本次未修改畫面來驗證熱更新，也未進行正式環境建置。

## 2A 帳號操作與重驗（2026-10-15）

在專案根目錄 PowerShell 執行；既有資料會保留：

```powershell
docker compose exec -T backend python -c "from app.migrate import migrate; migrate(max_version=3)"
docker compose exec backend python -m app.bootstrap_admin
```

第二行僅在需要建立首位系統管理員時執行，依提示輸入姓名、Email、電話及密碼；密碼為隱藏輸入，不使用預設密碼。已有同 Email 系統管理員時不修改；其他系統管理員已存在時拒絕新增。

從 `http://localhost:3001` 進入登入／住戶註冊，登入依角色導向首頁，可修改自己的姓名電話及登出。姓名以 Unicode 字元計 1～100、電話 8～20；Email 不可修改。D-25 的關聯查詢留到 2B／2D。

獨立驗收庫 `parcel_management_test` 需先建立並授權後端資料庫帳號；不要將開發資料庫改名代用。已有測試庫後執行：

```powershell
docker compose exec -T -e DB_NAME=parcel_management_test backend python -m app.acceptance_2a
docker compose run --rm --no-deps frontend npm run build
```

驗收程式只接受上述測試庫名，建立具唯一 Email 的測試資料，保留測試紀錄；會調整測試庫的限流視窗、測試帳號啟用及登入期限，不碰開發帳號。

寫入請求須帶允許的 Origin（Swagger 本機來源已列入 API_ORIGINS）。跨來源前端使用 CORS_ORIGINS。正式 HTTPS 必須使用 COOKIE_SECURE=true；本機 Compose 的 false 僅適用 HTTP 開發。登入 IP 限流取伺服器辨識的連線來源，部署反向代理時須另核對可信代理及來源設定。

## DB 備份還原與重啟驗收

先完成獨立測試庫的後端驗收，再於專案根目錄 PowerShell 執行：

```powershell
python -X utf8 backend/database_recovery.py
```

工具使用容器內的 mysqldump，匯出固定 `parcel_management_test`，還原至隨機名稱的新測試庫，並比對完整結構與資料。來源庫及既有還原庫皆不會被覆寫；備份與結果保存於 Git 忽略的 `artifacts/database-recovery/`。這是測試工具，不是開發庫的備份指令。

若要同時驗證容器重啟後資料保存：

```powershell
python -X utf8 backend/database_recovery.py --restart-mysql
```

此選項會重啟本機 MySQL，本機 API 短暫無法連線；不刪除容器或 volume。還原後、重啟後分別比對資料，失敗時以非零退出碼結束。不要與其他會寫入測試庫的驗收程式同時執行。

備份內含測試帳號雜湊與取件碼密文，請勿提交或公開。SQL 不含 `CODE_ENCRYPTION_KEY`；實際災難復原還須安全保留原環境金鑰，不能另產新鍵來解密舊資料。

單元測試不需要連線資料庫，但契約測試需要容器內的 Pydantic。於專案根目錄執行 `docker compose run --rm -T --no-deps -v "${PWD}/backend:/app" backend python -m unittest discover -s tests -v`；真實 HTTP／MySQL 驗收使用前述兩個 `app.acceptance_*` 指令。

## 外部參考資料

- [Docker Compose 健康檢查與啟動順序](https://docs.docker.com/compose/how-tos/startup-order/)
- [MySQL 官方映像與初始化說明](https://hub.docker.com/_/mysql)
