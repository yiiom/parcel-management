# Docker 開發環境

在專案根目錄執行下列指令。Docker Desktop 須先啟動，使用 Linux containers。
本設定供本機開發，不是正式部署設定。

## 第一次啟動

本機已準備 `.env` 並產生開發用隨機密碼；不要提交此檔。
新電腦請複製 `.env.example` 為 `.env`，設定兩組不同密碼。

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
目前只建立空資料庫與連線檢查入口，尚未建立 10 張業務資料表或 39 個業務 API。
`/docs` 是目前已實作的入口；`docs/swagger` 則是未實作完成的設計草案。

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

## 本次驗證

- 三個容器已成功建置並啟動。
- MySQL 與後端容器健康檢查通過。
- 前端首頁與後端 `/docs` 回傳 HTTP 200。
- `/health` 回傳 `status: ok`、`database: connected`，確認後端實際可查詢 MySQL。
- 沿用原前端鎖檔；安裝時 npm 回報 5 項 high severity 套件弱點，尚未逐項審查或升級，正式部署前需另行處理。
- 檔案掛載已設定；本次未修改畫面來驗證熱更新，也未進行正式環境建置。

## 參考

- [Docker Compose 健康檢查與啟動順序](https://docs.docker.com/compose/how-tos/startup-order/)
- [MySQL 官方映像與初始化說明](https://hub.docker.com/_/mysql)
