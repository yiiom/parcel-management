#!/usr/bin/env bash
# 僅在隔離的 GitHub runner 使用；不連接 EC2 或本機開發資料庫。
set -Eeuo pipefail
SHA=${1:?Missing SHA}
[[ "$SHA" =~ ^[a-f0-9]{40}$ ]] || exit 2
# 未指定時使用本機以 SHA 標記的映像；CI 傳入 GHCR 映像名稱。
FRONTEND_IMAGE=${2:-parcel-frontend:$SHA}
BACKEND_IMAGE=${3:-parcel-backend:$SHA}
WORK=$(mktemp -d)
cp deploy/compose.prod.yaml deploy/nginx.conf deploy/nginx-https.conf deploy/nginx-locations.conf "$WORK/"
# 憑證與 ACME 驗證目錄使用相對路徑，與正式主機的 /opt 目錄分開。
mkdir -p "$WORK/tls/live/parcel" "$WORK/acme/.well-known/acme-challenge"
printf 'smoke-probe' > "$WORK/acme/.well-known/acme-challenge/probe"
python3 - "$WORK/.env" "$SHA" "$FRONTEND_IMAGE" "$BACKEND_IMAGE" <<'PY'
from pathlib import Path
import secrets,sys
p=Path(sys.argv[1]); sha,frontend,backend=sys.argv[2:5]
p.write_text(f'MYSQL_PASSWORD={secrets.token_hex(24)}\nMYSQL_ROOT_PASSWORD={secrets.token_hex(24)}\nAPP_BASE_URL=http://127.0.0.1:18080\nHTTP_BIND=127.0.0.1\nHTTP_PORT=18080\nHTTPS_PORT=18443\nTLS_DIR=./tls\nACME_DIR=./acme\nFRONTEND_IMAGE={frontend}\nBACKEND_IMAGE={backend}\n')
# 將 CI volume 與正式主機的 volume 名稱完全分開。
c=p.parent/'compose.prod.yaml'
c.write_text(c.read_text(encoding='utf-8').replace('name: parcel-management_mysql_data',f'name: parcel-ci-{sha}_mysql_data'),encoding='utf-8')
PY
compose() { docker compose -p "parcel-ci-$SHA" --env-file "$WORK/.env" -f "$WORK/compose.prod.yaml" "$@"; }
# 僅停止隔離的測試容器，不刪除任何 volume；runner 結束時回收 VM。
trap 'compose down --remove-orphans; rm -rf -- "$WORK"' EXIT
compose up -d --wait --wait-timeout 240
compose run --rm --no-deps backend python -m app.migrate
compose run --rm --no-deps backend python -m app.migrate
health() { python3 -c 'import json,sys; d=json.load(sys.stdin); assert d=={"status":"ok","database":"connected"}'; }
curl -fsS http://127.0.0.1:18080/ >/dev/null
curl -fsS http://127.0.0.1:18080/health | health
[[ $(curl -fsS http://127.0.0.1:18080/.well-known/acme-challenge/probe) == smoke-probe ]]

# HTTPS 模式：以自簽憑證驗證 nginx-https.conf，只重建 Nginx。
(cd "$WORK/tls/live/parcel" && MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:2048 -nodes -days 1 \
    -subj "/CN=parcel-ci" -keyout privkey.pem -out fullchain.pem 2>/dev/null)
NGINX_CONF=nginx-https.conf compose up -d --wait --wait-timeout 120
curl -fsSk https://127.0.0.1:18443/ >/dev/null
curl -fsSk https://127.0.0.1:18443/health | health
[[ $(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:18080/) == 301 ]]
# 轉址後憑證續期的 HTTP 驗證路徑仍須可用。
[[ $(curl -fsS http://127.0.0.1:18080/.well-known/acme-challenge/probe) == smoke-probe ]]
