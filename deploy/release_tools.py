"""驗證部署包及映像設定；不執行 manifest 中的程式碼。"""
import argparse
import hashlib
import json
import re
import tarfile
from pathlib import Path

FILES = {"compose.prod.yaml", "nginx.conf", "release.sh", "release_tools.py", "manifest.json"}
IMAGE = re.compile(r"[a-zA-Z0-9][a-zA-Z0-9._/:-]*(?:@sha256:[a-f0-9]{64})?\Z")


def read_manifest(directory):
    data = json.loads((directory / "manifest.json").read_text())
    if set(data) != {"revision", "frontend_image", "backend_image"}:
        raise ValueError("manifest 欄位錯誤")
    if not re.fullmatch(r"[a-f0-9]{40}", data["revision"]):
        raise ValueError("revision 必須為完整 commit SHA")
    for key in ("frontend_image", "backend_image"):
        if not isinstance(data[key], str) or not IMAGE.fullmatch(data[key]):
            raise ValueError("映像名稱不合法")
        if not ("@sha256:" in data[key] or data[key].endswith(":" + data["revision"])):
            raise ValueError("映像必須使用 digest 或與 revision 相同的 tag")
    return data


def extract(archive, destination, expected_sha):
    # 壓縮包仅允許固定的普通檔案，拒絕連結、子目錄及重複項目。
    with tarfile.open(archive, "r:gz") as bundle:
        members = bundle.getmembers()
        if {m.name for m in members} != FILES or len(members) != len(FILES):
            raise ValueError("部署包檔案清單不符")
        if any(not m.isfile() or m.size > 1024 * 1024 for m in members):
            raise ValueError("部署包包含連結或過大檔案")
        destination.mkdir(parents=True, exist_ok=False)
        for member in members:
            with bundle.extractfile(member) as source:
                (destination / member.name).write_bytes(source.read())
    if read_manifest(destination)["revision"] != expected_sha:
        raise ValueError("部署包版本不符")


def package(source, destination, sha, frontend, backend):
    destination.mkdir(parents=True, exist_ok=True)
    manifest = {"revision": sha, "frontend_image": frontend, "backend_image": backend}
    (destination / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    read_manifest(destination)
    archive = destination / "release.tar.gz"
    with tarfile.open(archive, "w:gz") as bundle:
        for name in sorted(FILES):
            path = destination / name if name == "manifest.json" else source / name
            bundle.add(path, arcname=name)
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    (destination / "release.tar.gz.sha256").write_text(digest + "  release.tar.gz\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest="command", required=True)
    p = commands.add_parser("package")
    p.add_argument("source", type=Path)
    p.add_argument("destination", type=Path)
    p.add_argument("sha")
    p.add_argument("frontend")
    p.add_argument("backend")
    p = commands.add_parser("extract")
    p.add_argument("archive", type=Path)
    p.add_argument("destination", type=Path)
    p.add_argument("sha")
    p = commands.add_parser("env")
    p.add_argument("directory", type=Path)
    args = parser.parse_args()
    if args.command == "package":
        package(args.source, args.destination, args.sha, args.frontend, args.backend)
    elif args.command == "extract":
        extract(args.archive, args.destination, args.sha)
    else:
        data = read_manifest(args.directory)
        (args.directory / "images.env").write_text(
            f"FRONTEND_IMAGE={data['frontend_image']}\nBACKEND_IMAGE={data['backend_image']}\n"
        )
