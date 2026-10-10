#!/usr/bin/env bash
# 在 EC2 執行；不建置映像、不執行資料庫 migration、不刪除 volume。
# 部署成功後清理 current、previous 以外的前後端映像與版本目錄。
set -Eeuo pipefail
umask 077
BASE=/opt/parcel-management
RELEASE=$(realpath "${1:?Missing release directory}")
[[ "$RELEASE" == "$BASE/releases/"* && -f "$RELEASE/manifest.json" ]] || exit 2
MODE=${2:-pull}
[[ "$MODE" == pull || "$MODE" == local ]] || exit 2
WAIT_TIMEOUT=${DEPLOY_WAIT_TIMEOUT:-240}
[[ "$WAIT_TIMEOUT" =~ ^[0-9]+$ ]] || exit 2
mkdir -p "$BASE/shared"
exec 9>"$BASE/shared/deploy.lock"
flock -w 1200 9
test -s "$BASE/shared/.env"
python3 "$RELEASE/release_tools.py" env "$RELEASE"

compose() {
    local directory=$1
    shift
    docker compose -p parcel-management --env-file "$BASE/shared/.env" \
        --env-file "$directory/images.env" -f "$directory/compose.prod.yaml" "$@"
}
verify() {
    local directory=$1
    compose "$directory" exec -T nginx wget -q -O /dev/null http://127.0.0.1/ || return 1
    compose "$directory" exec -T nginx wget -q -O - http://127.0.0.1/health \
        | python3 -c 'import json,sys; d=json.load(sys.stdin); sys.exit(0 if d.get("status")=="ok" and d.get("database")=="connected" else 1)'
}
record() {
    printf '%s %s %s\n' "$(date -u +%FT%TZ)" "$RELEASE" "$1" >> "$BASE/shared/deployments.log"
}
cleanup() {
    # 只保留 current 與 previous 的前後端映像及版本目錄供回復。
    # 不處理 volume、MySQL 與 Nginx 映像；使用中的映像 Docker 會拒絕刪除。
    local keep_dirs keep_refs keep_ids dir id
    keep_dirs=$(readlink -f "$BASE/current" "$BASE/previous" 2>/dev/null || true)
    # 保留清單必須包含剛完成的版本，否則不做任何刪除。
    grep -qxF "$RELEASE" <<<"$keep_dirs" || return 1
    keep_refs=$(while read -r dir; do
        if [[ -f "$dir/images.env" ]]; then cut -d= -f2- "$dir/images.env"; fi
    done <<<"$keep_dirs")
    keep_ids=$(xargs -r docker image inspect --format '{{.Id}}' <<<"$keep_refs" 2>/dev/null || true)
    if [[ -n "$keep_ids" ]]; then
        docker image ls --no-trunc --format '{{.Repository}} {{.ID}}' \
            | awk '$1 ~ /(^|\/)parcel-(frontend|backend)$/ {print $2}' | sort -u \
            | while read -r id; do
                grep -qxF "$id" <<<"$keep_ids" || docker image rm "$id" || true
            done
    fi
    docker image prune --force >/dev/null
    find "$BASE/releases" -mindepth 2 -maxdepth 2 -type d | while read -r dir; do
        grep -qxF "$dir" <<<"$keep_dirs" || rm -rf -- "$dir"
    done
    find "$BASE/releases" -mindepth 1 -maxdepth 1 -type d -empty -delete
}

compose "$RELEASE" config --quiet
# pull 由主機從映像倉庫取得前後端映像；local 使用已載入主機的映像。
if [[ "$MODE" == pull ]]; then compose "$RELEASE" pull frontend backend; fi
PREVIOUS=''
if [[ -L "$BASE/current" ]]; then PREVIOUS=$(readlink -f "$BASE/current"); fi
record started
if compose "$RELEASE" up -d --wait --wait-timeout "$WAIT_TIMEOUT" --remove-orphans && verify "$RELEASE"; then
    if [[ -n "$PREVIOUS" && "$PREVIOUS" != "$RELEASE" ]]; then
        ln -sfn "$PREVIOUS" "$BASE/previous.new"
        mv -Tf "$BASE/previous.new" "$BASE/previous"
    fi
    ln -sfn "$RELEASE" "$BASE/current.new"
    mv -Tf "$BASE/current.new" "$BASE/current"
    record success
    cleanup || echo '警告：舊版本清理未完成，不影響本次部署' >&2
    echo "部署成功：$RELEASE"
else
    record failed
    compose "$RELEASE" ps || true
    if [[ "$PREVIOUS" == "$BASE/releases/"* && -f "$PREVIOUS/images.env" ]]; then
        if compose "$PREVIOUS" up -d --wait --wait-timeout 240 && verify "$PREVIOUS"; then
            record rollback-success
            echo "已回復上一個成功版本：$PREVIOUS" >&2
        else
            record rollback-failed
            echo "回復失敗，請檢查主機服務" >&2
        fi
    else
        echo "首次部署失敗，沒有可回復版本" >&2
    fi
    exit 1
fi
