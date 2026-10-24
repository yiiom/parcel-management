"""透過環境變數連線，不在程式碼保存密碼。"""

import os

import mysql.connector


def get_connection():
    return mysql.connector.connect(
        host=os.environ["DB_HOST"],
        port=int(os.environ.get("DB_PORT", "3306")),
        database=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        connection_timeout=3,
        charset="utf8mb4",
        collation="utf8mb4_0900_ai_ci",
        time_zone="+00:00",
    )
