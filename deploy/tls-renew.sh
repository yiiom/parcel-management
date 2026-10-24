#!/usr/bin/env bash
# 由 systemd timer 定期以 root 執行：檢查憑證續期，有更新才重新載入 Nginx。
set -Eeuo pipefail
umask 077
BASE=/opt/parcel-management
# certbot 5.8.0；與 tls-issue.sh 保持相同。
CERTBOT_IMAGE=certbot/certbot@sha256:f70ad0adbb7e117f0fe42a63c553f28ea451edabc0148757b6efcd9735acaa20
FLAG="$BASE/shared/letsencrypt/.reload-nginx"
# deploy-hook 在 certbot 容器內執行，只留下標記；重新載入由主機端處理。
docker run --rm -v "$BASE/shared/letsencrypt:/etc/letsencrypt" -v "$BASE/shared/acme:/var/www/acme" \
    "$CERTBOT_IMAGE" renew --non-interactive --deploy-hook 'touch /etc/letsencrypt/.reload-nginx'
if [[ -e "$FLAG" ]]; then
    NGINX=$(docker ps -q --filter label=com.docker.compose.project=parcel-management \
        --filter label=com.docker.compose.service=nginx)
    if [[ -n "$NGINX" ]]; then docker exec "$NGINX" nginx -s reload; fi
    rm -f -- "$FLAG"
    echo '憑證已更新並重新載入 Nginx'
fi
