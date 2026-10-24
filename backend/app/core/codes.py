"""原碼不寫日誌；邀請碼只保存 keyed hash，取件碼以 Fernet 認證加密。"""

import base64
import hashlib
import hmac
import os
from cryptography.fernet import Fernet


def key():
    value = os.environ.get("CODE_ENCRYPTION_KEY")
    if not value:
        raise RuntimeError("尚未設定碼加密金鑰。")
    return value.encode("ascii")


def digest(purpose, code):
    return hmac.new(
        base64.urlsafe_b64decode(key()), (purpose + ":" + code).encode(), hashlib.sha256
    ).hexdigest()


def encrypt(code):
    return Fernet(key()).encrypt(code.encode()).decode()


def decrypt(value):
    return Fernet(key()).decrypt(value.encode()).decode()
