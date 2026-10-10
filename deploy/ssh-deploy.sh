#!/usr/bin/env bash
# 將部署包傳送至既有 EC2；映像由主機自行從 GHCR 取得。
set -Eeuo pipefail
umask 077
SHA=${GITHUB_SHA:?}
RUN="${GITHUB_RUN_ID:?}-${GITHUB_RUN_ATTEMPT:?}"
[[ "$SHA" =~ ^[a-f0-9]{40}$ && "$RUN" =~ ^[0-9]+-[0-9]+$ ]] || exit 2
WORK=$(mktemp -d)
trap 'rm -rf -- "$WORK"' EXIT
printf '%s\n' "${EC2_SSH_KEY:?}" > "$WORK/key"
unset EC2_SSH_KEY
chmod 600 "$WORK/key"
SSH_OPTIONS=(-i "$WORK/key" -o BatchMode=yes -o ConnectTimeout=30
    -o StrictHostKeyChecking=yes -o UserKnownHostsFile=deploy/ec2_known_hosts)
TARGET="${EC2_USER:?}@${EC2_HOST:?}"
UPLOAD="/home/ubuntu/parcel-release-$SHA-$RUN"
# 映像名稱由 release_tools.py 驗證，僅接受 digest 或與 revision 相同的 tag。
python3 deploy/release_tools.py package deploy artifacts/release "$SHA" \
    "${FRONTEND_IMAGE:?}" "${BACKEND_IMAGE:?}"
cp deploy/install-release.sh deploy/release_tools.py artifacts/release/
# 路徑及參數已限制為固定前綴、SHA 與數字，刻意在 runner 展開。
# shellcheck disable=SC2029
ssh "${SSH_OPTIONS[@]}" "$TARGET" "mkdir -m 700 '$UPLOAD'"
scp "${SSH_OPTIONS[@]}" artifacts/release/* "$TARGET:$UPLOAD/"
# GHCR 帳號與短效 token 經 stdin 傳入，不出現在命令列，也不寫入主機檔案。
# shellcheck disable=SC2029
printf '%s\n%s\n' "${GITHUB_ACTOR:?}" "${GHCR_TOKEN:?}" \
    | ssh "${SSH_OPTIONS[@]}" "$TARGET" "sudo bash '$UPLOAD/install-release.sh' '$UPLOAD' '$SHA' '$RUN'"
curl --fail --silent --show-error --retry 5 --retry-all-errors \
    --connect-timeout 10 --max-time 30 "http://$EC2_HOST/" >/dev/null
curl --fail --silent --show-error --retry 5 --retry-all-errors \
    --connect-timeout 10 --max-time 30 "http://$EC2_HOST/health" \
    | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d=={"status":"ok","database":"connected"}'
echo "已部署 $SHA" >> "$GITHUB_STEP_SUMMARY"
