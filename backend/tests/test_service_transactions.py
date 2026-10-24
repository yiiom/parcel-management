"""拆分服務後仍須共用交易，並在失敗時釋放資料庫鎖。"""

import unittest
from contextlib import contextmanager
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from app.core.errors import APIError
from app.services.transactions import transaction


class ServiceTransactionTests(unittest.TestCase):
    @contextmanager
    def database(self, acquired=True):
        db = MagicMock()
        cursor = db.cursor.return_value
        current = {"id": 1, "is_active": True, "role": "resident"}
        cursor.fetchone.side_effect = [{"ok": int(acquired)}, current, None]
        with patch.dict("os.environ", {"DB_NAME": "parcel_management_test"}):
            with patch("app.services.transactions.get_connection") as connect:
                connect.return_value.__enter__.return_value = db
                yield db, cursor, current

    def test_services_share_transaction_and_commit_once(self):
        with self.database() as (db, cursor, current):
            with transaction(SimpleNamespace(id=1)) as services:
                for service in (
                    services.parcels, services.pickups, services.occupancies,
                    services.invitations, services.memberships, services.permissions,
                ):
                    self.assertIs(service.db, db)
                    self.assertIs(service.c, cursor)
                    self.assertIs(service.user, current)
                services.parcels.update("parcels", 1, {"status": "picked_up"})
                services.pickups.update("pickup_verifications", 1, {"status": "confirmed"})
                db.commit.assert_not_called()
            db.commit.assert_called_once_with()
            db.rollback.assert_not_called()
            cursor.execute.assert_called_with(
                "SELECT RELEASE_LOCK(%s)", ("parcel-domain:parcel_management_test",)
            )
            cursor.close.assert_called_once_with()

    def test_cross_service_failure_rolls_back_and_releases_lock(self):
        with self.database() as (db, cursor, _):
            with self.assertRaisesRegex(RuntimeError, "故障注入"):
                with transaction(SimpleNamespace(id=1)) as services:
                    services.occupancies.update("occupancies", 1, {"ended_at": None})
                    with patch.object(services.pickups, "execute", side_effect=RuntimeError("故障注入")):
                        services.pickups.cancel_waiting(1)
            db.commit.assert_not_called()
            db.rollback.assert_called_once_with()
            cursor.execute.assert_called_with(
                "SELECT RELEASE_LOCK(%s)", ("parcel-domain:parcel_management_test",)
            )
            cursor.close.assert_called_once_with()

    def test_lock_failure_never_enters_service_or_releases_unowned_lock(self):
        with self.database(acquired=False) as (db, cursor, _):
            with self.assertRaises(APIError) as caught:
                with transaction(SimpleNamespace(id=1)):
                    self.fail("未取得鎖卻開始業務操作")
            self.assertEqual(caught.exception.status, 409)
            db.commit.assert_not_called()
            db.rollback.assert_called_once_with()
            cursor.execute.assert_called_once_with(
                "SELECT GET_LOCK(%s, 10) AS ok", ("parcel-domain:parcel_management_test",)
            )
            cursor.close.assert_called_once_with()
