#!/usr/bin/env bash
# 維護者首次以 sudo bash deploy/bootstrap.sh 執行。
set -Eeuo pipefail
umask 077
[[ $(id -u) == 0 ]] || { echo '請使用 sudo' >&2; exit 1; }
SOURCE=$(cd -- "$(dirname -- "$0")" && pwd)
BASE=/opt/parcel-management
install -d -m 700 "$BASE/shared" "$BASE/releases" "$BASE/tools"
install -m 644 "$SOURCE/release_tools.py" "$BASE/tools/release_tools.py"
if [[ ! -e "$BASE/shared/.env" ]]; then
    python3 - "$BASE/shared/.env" <<'PY'
import secrets,sys
from pathlib import Path
p=Path(sys.argv[1])
p.write_text('MYSQL_PASSWORD='+secrets.token_hex(24)+'\nMYSQL_ROOT_PASSWORD='+secrets.token_hex(24)+'\nAPP_BASE_URL=http://18.183.250.218\nHTTP_PORT=80\n')
p.chmod(0o600)
PY
fi
chmod 600 "$BASE/shared/.env"
systemctl enable --now docker
echo '部署入口與主機環境檔已備妥，既有密碼不會被覆寫。'
