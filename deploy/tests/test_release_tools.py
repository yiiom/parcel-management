import importlib.util
import io
import json
import tarfile
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("release_tools", ROOT / "release_tools.py")
tools = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tools)
SHA = "1" * 40


class ReleaseTests(unittest.TestCase):
    def test_package_round_trip_and_revision_guard(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            tools.package(ROOT, root / "bundle", SHA, f"parcel-frontend:{SHA}", f"parcel-backend:{SHA}")
            tools.extract(root / "bundle/release.tar.gz", root / "release", SHA)
            self.assertEqual(tools.read_manifest(root / "release")["revision"], SHA)
            with self.assertRaises(ValueError):
                tools.extract(root / "bundle/release.tar.gz", root / "wrong", "2" * 40)

    def test_reject_shell_injection_and_mutable_tags(self):
        for image in ["example:latest", "example:$(id)", "example:foo\nKEY=evil"]:
            with self.subTest(image=image), tempfile.TemporaryDirectory() as tmp:
                p = Path(tmp)
                (p / "manifest.json").write_text(json.dumps({"revision": SHA, "frontend_image": image, "backend_image": f"backend:{SHA}"}))
                with self.assertRaises(ValueError):
                    tools.read_manifest(p)

    def test_registry_images_require_digest(self):
        repository = "ghcr.io/example/parcel-frontend"
        for image, accepted in [(f"{repository}@sha256:{'a' * 64}", True), (f"{repository}:{'b' * 40}", False)]:
            with self.subTest(image=image), tempfile.TemporaryDirectory() as tmp:
                p = Path(tmp)
                (p / "manifest.json").write_text(json.dumps({"revision": SHA, "frontend_image": image, "backend_image": f"backend:{SHA}"}))
                if accepted:
                    self.assertEqual(tools.read_manifest(p)["frontend_image"], image)
                else:
                    with self.assertRaises(ValueError):
                        tools.read_manifest(p)

    def test_reject_path_traversal_and_links(self):
        for name, kind in [("../outside", tarfile.REGTYPE), ("manifest.json", tarfile.SYMTYPE)]:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as tmp:
                p = Path(tmp)
                with tarfile.open(p / "bad.tar.gz", "w:gz") as archive:
                    for entry in tools.FILES - {"manifest.json"}:
                        member = tarfile.TarInfo(entry)
                        archive.addfile(member, io.BytesIO())
                    member = tarfile.TarInfo(name)
                    member.type = kind
                    member.linkname = "../../outside"
                    archive.addfile(member, io.BytesIO())
                with self.assertRaises(ValueError):
                    tools.extract(p / "bad.tar.gz", p / "out", SHA)
                self.assertFalse((p / "outside").exists())


if __name__ == "__main__":
    unittest.main()
