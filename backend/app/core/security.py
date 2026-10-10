"""登入憑證不保存原文；密碼使用 Argon2id。"""

import hashlib

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

hasher = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=4)
DUMMY_HASH = hasher.hash("non-account-timing-placeholder")


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def verify_password(encoded: str, password: str) -> bool:
    try:
        return hasher.verify(encoded, password)
    except (VerificationError, InvalidHashError):
        return False
