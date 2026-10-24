#!/usr/bin/env bash
# 維護者於主機以 sudo 執行：申請 TLS 憑證並安裝自動續期。可重複執行。
# 執行本腳本即代表同意 Let's Encrypt 訂閱者協議（https://letsencrypt.org/repository/），
# 並在本機建立不含 Email 的 ACME 帳號。不修改 Nginx 模式；啟用 HTTPS 另見 docs/cicd-deployment.md。
set -Eeuo pipefail
umask 077
[[ $(id -u) == 0 ]] || { echo '請使用 sudo' >&2; exit 1; }
TARGET=${1:?用法：sudo bash tls-issue.sh <IPv4 位址或網域>}
SOURCE=$(cd -- "$(dirname -- "$0")" && pwd)
BASE=/opt/parcel-management
# certbot 5.8.0；與 tls-renew.sh 保持相同。
CERTBOT_IMAGE=certbot/certbot@sha256:f70ad0adbb7e117f0fe42a63c553f28ea451edabc0148757b6efcd9735acaa20
if [[ "$TARGET" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
    # Let's Encrypt 的 IP 憑證只能使用 shortlived 設定檔，效期約 6 天。
    SUBJECT=(--ip-address "$TARGET" --required-profile shortlived)
elif [[ "$TARGET" =~ ^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$ ]]; then
    SUBJECT=(--domain "$TARGET")
else
    echo '目標必須是 IPv4 位址或小寫網域' >&2
    exit 2
fi
install -d -m 700 "$BASE/shared/letsencrypt" "$BASE/tools"
install -d -m 755 "$BASE/shared/acme"
# 憑證固定命名為 parcel，Nginx 設定不必隨 IP 或網域變動。
REQUEST=(certonly --non-interactive --agree-tos --register-unsafely-without-email
    --webroot --webroot-path /var/www/acme --cert-name parcel "${SUBJECT[@]}")

# 先向測試環境申請，確認 80 埠驗證可通；測試帳號與憑證放在暫存目錄，結束即刪除。
TRIAL=$(mktemp -d)
trap 'rm -rf -- "$TRIAL"' EXIT
echo '== 測試環境申請 =='
docker run --rm -v "$TRIAL:/etc/letsencrypt" -v "$BASE/shared/acme:/var/www/acme" \
    "$CERTBOT_IMAGE" "${REQUEST[@]}" --staging
echo '== 正式申請 =='
docker run --rm -v "$BASE/shared/letsencrypt:/etc/letsencrypt" -v "$BASE/shared/acme:/var/www/acme" \
    "$CERTBOT_IMAGE" "${REQUEST[@]}"
test -s "$BASE/shared/letsencrypt/live/parcel/fullchain.pem"

# 續期腳本放在固定位置，版本回復時 timer 仍可執行。
install -m 700 "$SOURCE/tls-renew.sh" "$BASE/tools/tls-renew.sh"
cat > /etc/systemd/system/parcel-tls-renew.service <<'UNIT'
[Unit]
Description=Renew parcel-management TLS certificate
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/usr/bin/bash /opt/parcel-management/tools/tls-renew.sh
UNIT
cat > /etc/systemd/system/parcel-tls-renew.timer <<'UNIT'
[Unit]
Description=Check parcel-management TLS certificate renewal every 6 hours

[Timer]
OnCalendar=*-*-* 00/6:23:00
RandomizedDelaySec=600
Persistent=true

[Install]
WantedBy=timers.target
UNIT
chmod 644 /etc/systemd/system/parcel-tls-renew.service /etc/systemd/system/parcel-tls-renew.timer
systemctl daemon-reload
systemctl enable --now parcel-tls-renew.timer
echo "憑證已取得：$TARGET；自動續期已啟用（每 6 小時檢查）。"
