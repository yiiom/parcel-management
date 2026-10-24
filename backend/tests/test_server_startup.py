"""避免測試在服務啟動失敗後繼續，或誤測連接埠上的既有服務。"""

import unittest
from unittest.mock import Mock
from urllib.error import URLError

from app.test_support import wait_for_server


class ServerStartupTests(unittest.TestCase):
    def test_ready_server(self):
        wait_for_server(Mock(poll=Mock(return_value=None)), lambda: True)

    def test_retries_connection_failure(self):
        health = Mock(side_effect=[URLError("尚未啟動"), True])
        wait_for_server(Mock(poll=Mock(return_value=None)), health, delay=0)
        self.assertEqual(health.call_count, 2)

    def test_timeout_stops_acceptance(self):
        with self.assertRaisesRegex(RuntimeError, "逾時"):
            wait_for_server(
                Mock(poll=Mock(return_value=None)), lambda: False, attempts=2, delay=0
            )

    def test_exited_process_does_not_probe_other_server(self):
        health = Mock(return_value=True)
        with self.assertRaisesRegex(RuntimeError, "已退出"):
            wait_for_server(Mock(poll=Mock(return_value=1)), health)
        health.assert_not_called()

    def test_process_exiting_during_probe_is_rejected(self):
        with self.assertRaisesRegex(RuntimeError, "已退出"):
            wait_for_server(Mock(poll=Mock(side_effect=[None, 1])), lambda: True)
