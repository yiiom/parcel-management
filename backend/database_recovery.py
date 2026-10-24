"""在專案根目錄執行：python backend/database_recovery.py [--restart-mysql]。

只匯出 parcel_management_test；還原至新建的獨立資料庫，不覆寫既有庫。
備份含測試帳號雜湊，放在 Git 忽略的 artifacts；不輸出內容或密碼。
"""

import argparse
import hashlib
import re
import secrets
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = "parcel_management_test"


def docker(*args, data=None):
    result = subprocess.run(
        ["docker", "compose", *args],
        cwd=ROOT,
        input=data,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=180,
    )
    if result.returncode:
        # 不印子程序輸出，避免備份內容或環境資訊出現在終端。
        raise RuntimeError("Docker／MySQL 指令失敗，請檢查服務與測試庫權限。")
    return result.stdout


def database_name(value):
    if value != SOURCE and not re.fullmatch(r"parcel_restore_test_[0-9a-f]{12}", value):
        raise ValueError("僅允許固定測試庫或新建的還原測試庫。")
    return value


def mysql(sql):
    return docker(
        "exec",
        "-T",
        "mysql",
        "sh",
        "-c",
        'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot --batch --skip-column-names',
        data=sql.encode("utf-8"),
    )


def dump(name):
    database_name(name)
    return docker(
        "exec",
        "-T",
        "mysql",
        "sh",
        "-c",
        'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot '
        "--single-transaction --no-tablespaces --set-gtid-purged=OFF "
        '--hex-blob --order-by-primary --skip-comments --skip-dump-date "$1"',
        "dump",
        name,
    )


def restore(name, content):
    database_name(name)
    if name == SOURCE:
        raise ValueError("禁止覆寫來源測試庫。")
    # 不使用 IF NOT EXISTS：若名稱已存在就停止，不允許覆寫。
    mysql(f"CREATE DATABASE `{name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;")
    docker(
        "exec",
        "-T",
        "mysql",
        "sh",
        "-c",
        'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot "$1"',
        "restore",
        name,
        data=content,
    )


def run(restart_mysql=False):
    target = "parcel_restore_test_" + secrets.token_hex(6)
    content = dump(SOURCE)
    if b"CREATE TABLE" not in content or b"INSERT INTO" not in content:
        raise RuntimeError("來源沒有完整結構與測試資料，停止驗收。")
    directory = ROOT / "artifacts" / "database-recovery" / target
    directory.mkdir(parents=True, exist_ok=False)
    (directory / "backup.sql").write_bytes(content)
    restore(target, content)
    if dump(target) != content:
        raise AssertionError("還原後結構或資料與備份不同。")
    print("PASS 備份還原：完整 SQL 結構與資料逐位元組相同。", flush=True)
    if restart_mysql:
        # 只重啟服務，不移除容器或 volume；開發 API 會短暫無法連線。
        docker("restart", "mysql")
        for _ in range(60):
            try:
                mysql("SELECT 1;")
                break
            except RuntimeError:
                time.sleep(1)
        else:
            raise RuntimeError("MySQL 重啟後未恢復，停止驗收。")
        if dump(target) != content or dump(SOURCE) != content:
            raise AssertionError("重啟後來源或還原庫資料不一致。")
        print("PASS Docker 重啟：來源與還原庫完整結構、資料保持一致。", flush=True)
    evidence = (
        f"來源：{SOURCE}\n還原庫：{target}\n"
        f"備份 SHA256：{hashlib.sha256(content).hexdigest()}\n"
        "還原逐位元組比對：通過\n"
        f'Docker 重啟前後比對：{"通過" if restart_mysql else "未執行"}\n'
        "還原庫與備份保留，不刪除既有資料。加密碼仍須搭配原 CODE_ENCRYPTION_KEY。\n"
    )
    (directory / "result.txt").write_text(evidence, encoding="utf-8")
    print(f'證據：{directory / "result.txt"}', flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--restart-mysql", action="store_true")
    run(parser.parse_args().restart_mysql)
