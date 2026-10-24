# CI/CD 啟用與維護

更新日期：2026-10-11。依 [D-20](decisions.md)。入口為 [.github/workflows/deploy.yml](../.github/workflows/deploy.yml)。

**目前狀態：程式已完成並通過本機檢查，但尚未在 GitHub 實際執行過。** 啟用條件見「啟用前需要的設定」，驗證範圍見文末。

## 流程

推送到 main／master 或開 PR，且變更包含 `frontend/`、`backend/`、`deploy/` 或 workflow 本身時觸發；只修改 `docs/` 等其他檔案不會執行。也可在 GitHub Actions 頁面手動執行。

| 步驟 | 內容 | 位置 |
|---|---|---|
| 1. 判斷變更 | 以 `frontend`、`backend` 目錄內容的 Git tree SHA 當映像標籤。GHCR 已有相同標籤代表內容沒變，跳過該服務的建置 | workflow「判斷前端與後端是否變更」 |
| 2. 測試與編譯 | 有變更的服務執行檢查與編譯，任一項失敗即停止 | `frontend/Dockerfile.prod`、`backend/Dockerfile.prod` |
| 3. 打包映像 | 同一個建置步驟產出正式映像；未變更的服務改從 GHCR 取用既有映像 | 同上 |
| 4. 串接檢查並推送 | 以正式 Compose 啟動前端、後端、MySQL、Nginx，檢查首頁與 `/health`；通過後才 push 到 GHCR | [ci-smoke.sh](../deploy/ci-smoke.sh) |
| 5. EC2 pull 並啟動 | SSH 傳送部署包（設定檔與映像 digest），主機從 GHCR pull 後以 Compose 啟動並做健康檢查，失敗時回復上一版 | [ssh-deploy.sh](../deploy/ssh-deploy.sh)、[install-release.sh](../deploy/install-release.sh)、[release.sh](../deploy/release.sh) |
| 6. 清理舊版 | 部署成功後移除不再需要的映像、容器與版本目錄 | [release.sh](../deploy/release.sh) 的 `cleanup` |

PR 只執行步驟 1～4 的檢查，不 push 映像、不部署。只有 repository 預設分支會部署到 EC2：`ubuntu@54.199.27.86`。

### 各種修改會發生什麼

| 修改內容 | 建置 | EC2 上重啟的容器 |
|---|---|---|
| 只改 `frontend/` | 只建置前端 | 只有前端 |
| 只改 `backend/` | 只建置後端 | 只有後端 |
| 前後端都改 | 兩者都建置，只部署一次 | 前端與後端 |
| 只改 `deploy/` | 都不建置，仍執行串接檢查 | 只有設定受影響的服務 |
| 只改 `docs/` | 不執行 | 無 |

部署一律送出「前端映像＋後端映像」的完整組合，由 Docker Compose 比對後只重建映像或設定有變的容器。Nginx 透過 Docker 內部 DNS 找到前後端，不需跟著重啟。若某次建置失敗，下一次推送會自動補建，不會遺漏。

### 「測試」目前實際檢查的內容

- 前端：ESLint、TypeScript 型別檢查、`next build`。
- 後端：Python 編譯檢查、匯入 FastAPI app。
- 部署工具：`deploy/tests` 的 4 項單元測試、shell 腳本語法檢查。
- 串接：四個服務全部 healthy，首頁回應正常，`/health` 回傳資料庫已連線。

**前端與後端目前都沒有單元測試**，上述檢查不代表包裹業務功能正確。之後新增測試時，加進對應的 `Dockerfile.prod` 建置階段或 workflow 步驟即可納入。

## 啟用前需要的設定

1. GitHub repository 根目錄須包含 `.github`、`frontend`、`backend`、`deploy`。Repository 已建立並關聯（D-21）：https://github.com/yiiom/parcel-management ；依使用者要求目前只放文件，程式碼與 workflow 未納入，因此 CI/CD 不會執行。日後若推送 workflow 檔被拒絕並提示缺少 `workflow` scope，執行 `git credential-manager github login` 重新登入即可。
2. 在 repository Settings → Secrets and variables → Actions → Repository secrets 新增 `EC2_SSH_KEY`，值為可登入這台機器的 SSH 私鑰內容。私鑰不放進程式碼或提交 Git。**這是唯一需要手動新增的 Secret。**
3. EC2 安全群組的 SSH 22 埠必須允許實際執行 workflow 的 runner 來源。目前只允許單一 IP，GitHub runner 連不進來；此項未解決前自動部署無法成功。這條規則綁定的是設定當下的 IP，網路業者更換你的對外 IP 後，你自己的電腦也會連不上，需回 AWS 後台把來源重新選為「我的 IP」。
4. 主機須已安裝 Docker Compose，且 `/opt/parcel-management/shared/.env` 存在。這台 EC2 已完成準備；新主機首次執行 `sudo bash deploy/bootstrap.sh`。

GHCR 不需另外申請或設定：workflow 使用 GitHub 自動提供的 `GITHUB_TOKEN` 推送映像，第一次推送時自動建立 `parcel-frontend`、`parcel-backend` 兩個套件並連結到 repository。部署時同一個短效 token 經 SSH 的標準輸入交給主機登入，登入資訊放在暫存目錄、部署結束即刪除，token 也在 workflow 結束後失效。

主機公鑰記錄於 [ec2_known_hosts](../deploy/ec2_known_hosts)，來自目前已成功連線的主機。更換主機或 IP 時，確認公鑰後同步更新此檔、workflow 的 EC2_HOST 及主機 APP_BASE_URL。

## HTTPS

依 [D-23](decisions.md)。**目前狀態：已於 2026-10-11 在主機啟用。** 網址為 https://54.199.27.86/ ，`http://` 會自動轉址。真實的自動續期尚未發生過，見「已知限制」。

目前沒有網域，使用 Let's Encrypt 發給 IP `54.199.27.86` 的憑證。這類憑證效期只有約 6 天，必須靠自動續期維持。

| 項目 | 做法 |
|---|---|
| Nginx 模式 | [nginx.conf](../deploy/nginx.conf) 為 HTTP 模式（預設）；[nginx-https.conf](../deploy/nginx-https.conf) 為 HTTPS 模式，80 埠一律轉址到 HTTPS。由主機環境檔的 `NGINX_CONF` 選擇 |
| 轉送規則 | 兩種模式共用 [nginx-locations.conf](../deploy/nginx-locations.conf) |
| 憑證申請 | [tls-issue.sh](../deploy/tls-issue.sh)：以 Certbot 官方映像用 webroot 方式申請，先向測試環境試一次再正式申請，並安裝續期排程 |
| 自動續期 | [tls-renew.sh](../deploy/tls-renew.sh)：systemd timer `parcel-tls-renew.timer` 每 6 小時執行，憑證有更新才重新載入 Nginx |
| 憑證位置 | 主機 `/opt/parcel-management/shared/letsencrypt`，固定名稱 `parcel`；不進映像、不進版本管理，部署與清理都不會動到 |
| 健康檢查 | 容器內改用 `127.0.0.1:8081`，兩種模式都不轉址、不經 TLS |

安全群組需要對外開放 80 與 443。80 埠在 HTTPS 模式下仍必須開放，Let's Encrypt 續期時只會從 80 埠驗證。

### 啟用步驟

這台主機已完成以下步驟；新主機或更換 IP、改用網域時依序重做。

1. 部署含上述檔案的版本（仍是 HTTP 模式）。
2. 在主機執行 `sudo bash /opt/parcel-management/current/tls-issue.sh 54.199.27.86`。執行即代表同意 [Let's Encrypt 訂閱者協議](https://letsencrypt.org/repository/)，並在主機建立一個不含 Email 的 ACME 帳號，因此這一步由維護者本人執行。
3. 在主機環境檔加入 `NGINX_CONF=nginx-https.conf`，並把 `APP_BASE_URL` 改為 `https://54.199.27.86`，再重新套用目前版本。
4. workflow 的 `deploy` job 加上 `APP_BASE_URL: https://54.199.27.86`，部署後的公開檢查才會走 HTTPS。

### 已知限制

- **效期短**：續期若連續失敗約三天，憑證就會過期，瀏覽器會顯示警告。可用 `systemctl list-timers parcel-tls-renew.timer` 確認排程，用 `journalctl -u parcel-tls-renew.service` 查看紀錄。目前沒有到期告警。
- **真實續期尚未驗證**：第一張憑證效期為 2026-10-10 至 2026-10-17。排程已手動執行過一次並成功，但因憑證未到續期時間，實際的重新簽發與 Nginx 重新載入還沒發生過。預計 10 月 13 日前後會第一次真正續期，屆時應查看紀錄確認出現「憑證已更新並重新載入 Nginx」，並確認網站憑證的到期日有往後延。
- **未設定 HSTS**：刻意不設，避免續期失敗時瀏覽器完全拒絕開啟網站。
- **綁定 IP**：憑證只對 `54.199.27.86` 有效。更換 IP 需重新申請；日後有網域時以網域重新執行 `tls-issue.sh` 即可，Nginx 設定不必修改，憑證效期也會變成 90 天。
- **還原為 HTTP**：移除主機環境檔的 `NGINX_CONF` 並重新套用版本即可。

## 清理範圍

每次部署成功後自動執行，清理失敗只顯示警告，不影響部署結果。

| 項目 | 處理方式 |
|---|---|
| 舊容器 | Compose 重建服務時自動移除；`--remove-orphans` 移除已不在設定中的容器 |
| 前後端映像 | 只保留 current 與 previous 兩個版本使用的映像，其餘刪除 |
| 版本目錄 | `/opt/parcel-management/releases/` 只保留 current 與 previous |
| 上傳暫存目錄 | 每次部署結束即移除，失敗時也會移除 |
| MySQL 資料 volume | **不刪除** |
| MySQL、Nginx 映像 | 不處理 |

保留 previous 是為了部署失敗時能立即回復，不必重新下載。不使用 `docker system prune`、`docker volume prune`，也不執行 `docker compose down -v`。失敗的那次版本目錄會留到下一次部署成功時清除。

GHCR 上的舊映像版本目前不會自動刪除。私有 repository 若接近 GitHub Packages 儲存額度，再另行加入保留最近幾版的清理。

## 使用中的程式

- [deploy.yml](../.github/workflows/deploy.yml)：判斷變更、建置、串接檢查、推送映像、SSH 部署。
- [ci-smoke.sh](../deploy/ci-smoke.sh)：在 runner 上以隔離的專案名稱與 volume 做串接檢查。
- [ssh-deploy.sh](../deploy/ssh-deploy.sh)：打包並傳送部署包、傳遞短效 token、公開網址檢查。
- [install-release.sh](../deploy/install-release.sh)：驗證部署包、登入 GHCR、呼叫發版。
- [release.sh](../deploy/release.sh)：鎖定部署、pull 映像、健康檢查、版本回復、清理舊版。
- [release_tools.py](../deploy/release_tools.py)：部署包與映像名稱驗證，映像必須以 digest 指定。
- [compose.prod.yaml](../deploy/compose.prod.yaml)：前端、後端、MySQL 與 Nginx。
- [nginx.conf](../deploy/nginx.conf)、[nginx-https.conf](../deploy/nginx-https.conf)、[nginx-locations.conf](../deploy/nginx-locations.conf)：Nginx 的 HTTP／HTTPS 模式與共用轉送規則。
- [tls-issue.sh](../deploy/tls-issue.sh)、[tls-renew.sh](../deploy/tls-renew.sh)：憑證申請與自動續期。

`concurrency` 讓同一時間只有一個部署 job 執行，主機端另有檔案鎖。

## 驗證狀態

已在本機驗證（2026-10-11）：

- 部署工具單元測試 4 項通過；7 支腳本通過 `bash -n` 與 ShellCheck；workflow 通過 actionlint。
- `ci-smoke.sh` 以指定映像名稱執行：四個服務 healthy，首頁與 `/health` 通過；再以自簽憑證切換到 HTTPS 模式，HTTPS 首頁與 `/health` 通過、HTTP 回傳 301、憑證驗證路徑在兩種模式下皆可讀取，且切換時只有 Nginx 被重建。
- 以替身 `docker` 指令在隔離容器演練主機端流程：連續三次部署、失敗回復、缺少登入資訊三種情況下，pull 參數、current／previous 切換、暫存目錄與登入資訊移除、舊版本清理結果均符合預期。

**尚未驗證，不能視為已啟用：**

- GitHub push → GHCR → EC2 的實際端到端流程，包含真實的 GHCR 登入、pull 與映像刪除。
- 憑證到期前的真實自動續期（重新簽發並重新載入 Nginx）。

已在 EC2 實測（2026-10-11）：

- 只變更後端的環境設定並重新套用時，僅後端容器被重建，前端、Nginx、MySQL 維持運作。
- 以 `release.sh` 部署新版本：只有設定變更的 Nginx 被重建，部署成功後舊版本目錄自動清理為 current 與 previous 兩個。
- Let's Encrypt IP 憑證申請成功，切換 HTTPS 模式後，從主機與外部以一般憑證驗證連線 `https://54.199.27.86/` 皆為 200 且憑證受信任，`/health` 回傳資料庫已連線，`http://` 回傳 301 轉址。

部署檢查只有首頁及 `/health`；這些檢查不代表包裹業務功能已完成。
