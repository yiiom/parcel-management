"""備份工具的安全邊界；真實還原另由 database_recovery.py 驗證。"""

import unittest
from unittest.mock import patch

import database_recovery as recovery


class RecoverySafetyTests(unittest.TestCase):
    def test_only_test_databases_are_allowed(self):
        for name in (
            "parcel_management",
            "mysql",
            "other",
            "parcel_restore_test_x",
            "parcel_management_test; DROP DATABASE mysql",
        ):
            with self.subTest(name=name), self.assertRaises(ValueError):
                recovery.database_name(name)

    def test_restore_never_overwrites_source(self):
        with patch.object(recovery, "mysql") as mysql:
            with self.assertRaises(ValueError):
                recovery.restore(recovery.SOURCE, b"test")
            mysql.assert_not_called()

    def test_existing_target_stops_before_import(self):
        with (
            patch.object(recovery, "mysql", side_effect=RuntimeError("exists")),
            patch.object(recovery, "docker") as docker,
        ):
            with self.assertRaises(RuntimeError):
                recovery.restore("parcel_restore_test_123456abcdef", b"test")
            docker.assert_not_called()

    def test_valid_names(self):
        for name in (recovery.SOURCE, "parcel_restore_test_123456abcdef"):
            self.assertEqual(recovery.database_name(name), name)
