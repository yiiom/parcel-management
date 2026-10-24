"""整合測試共用的服務啟動檢查，不供正式 API 使用。"""
import time
from urllib.error import URLError


def wait_for_server(process, health_check, attempts=50, delay=0.2):
    """只在本次啟動的程序仍存活且健康檢查成功時繼續。"""
    for _ in range(attempts):
        if process.poll() is not None:
            raise RuntimeError('驗收服務已退出，停止測試。')
        try:
            healthy = health_check()
        except URLError:
            healthy = False
        if healthy:
            if process.poll() is not None:
                raise RuntimeError('驗收服務已退出，停止測試。')
            return
        time.sleep(delay)
    raise RuntimeError('等待驗收服務啟動逾時，停止測試。')
