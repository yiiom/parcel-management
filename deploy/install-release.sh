#!/usr/bin/env bash
# 由 SSH 部署流程以 sudo 執行；資料庫密碼留在主機。
# stdin 第一行為 GHCR 帳號，第二行為 workflow 的短效 token。
set -Eeuo pipefail
umask 077
UPLOAD=${1:?}
SHA=${2:?}
RUN=${3:?}
[[ $(id -u) == 0 && "$SHA" =~ ^[a-f0-9]{40}$ && "$RUN" =~ ^[0-9]+-[0-9]+$ ]] || exit 2
[[ "$UPLOAD" == "/home/ubuntu/parcel-release-$SHA-$RUN" ]] || exit 2
BASE=/opt/parcel-management
RELEASE="$BASE/releases/$SHA/$RUN"
# 登入資訊只放在暫存目錄；不論成功或失敗都移除，並清掉這次上傳目錄。
DOCKER_CONFIG=$(mktemp -d)
export DOCKER_CONFIG
trap 'rm -rf -- "$DOCKER_CONFIG" "$UPLOAD"' EXIT
if ! { IFS= read -r GHCR_USER && IFS= read -r GHCR_TOKEN; }; then
    echo '缺少 GHCR 登入資訊' >&2
    exit 2
fi
printf '%s' "$GHCR_TOKEN" | docker login ghcr.io --username "$GHCR_USER" --password-stdin >/dev/null
unset GHCR_TOKEN
cd "$UPLOAD"
sha256sum --check release.tar.gz.sha256
python3 "$UPLOAD/release_tools.py" extract "$UPLOAD/release.tar.gz" "$RELEASE" "$SHA"
# current、previous 與資料庫由 release.sh 保留；其餘舊版本在部署成功後清理。
bash "$RELEASE/release.sh" "$RELEASE" pull
