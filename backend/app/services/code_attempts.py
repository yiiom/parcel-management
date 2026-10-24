"""邀請碼與領取碼的錯誤次數及鎖定。"""

import math
from datetime import timedelta
from app.core.errors import APIError
from app.services.common import now
from app.services.common import fail
from app.services.base import BaseService


class CodeAttemptService(BaseService):
    def guard_code(self, purpose):
        self.execute(
            "INSERT INTO code_attempts (user_id,purpose) VALUES (%s,%s) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id)",
            (self.user["id"], purpose),
        )
        r = self.one(
            "SELECT * FROM code_attempts WHERE user_id=%s AND purpose=%s",
            (self.user["id"], purpose),
        )
        if r["blocked_until"] and r["blocked_until"] > now():
            raise APIError(
                429,
                "TOO_MANY_REQUESTS",
                "驗證暫停，請稍後再試。",
                {
                    "Retry-After": str(
                        max(1, math.ceil((r["blocked_until"] - now()).total_seconds()))
                    )
                },
            )
        if r["blocked_until"]:
            self.execute(
                "UPDATE code_attempts SET failures=0,blocked_until=NULL WHERE user_id=%s AND purpose=%s",
                (self.user["id"], purpose),
            )

    def code_result(self, purpose, success):
        if success:
            self.execute(
                "UPDATE code_attempts SET failures=0,blocked_until=NULL WHERE user_id=%s AND purpose=%s",
                (self.user["id"], purpose),
            )
            return
        self.execute(
            "UPDATE code_attempts SET failures=failures+1 WHERE user_id=%s AND purpose=%s",
            (self.user["id"], purpose),
        )
        r = self.one(
            "SELECT failures FROM code_attempts WHERE user_id=%s AND purpose=%s",
            (self.user["id"], purpose),
        )
        blocked = r["failures"] >= 5
        if blocked:
            self.execute(
                "UPDATE code_attempts SET blocked_until=%s WHERE user_id=%s AND purpose=%s",
                (now() + timedelta(minutes=5), self.user["id"], purpose),
            )
        self.db.commit()  # 只在尚未修改業務資料的驗碼階段，保留失敗計數。
        if blocked:
            raise APIError(
                429,
                "TOO_MANY_REQUESTS",
                "連續驗證失敗，請 5 分鐘後重試。",
                {"Retry-After": "300"},
            )
        fail(
            400,
            "邀請碼無效。" if purpose == "invite" else "取件碼無效。",
            "INVALID_INVITE_CODE" if purpose == "invite" else "INVALID_PICKUP_CODE",
        )
