CREATE TABLE auth_rate_limits (
    bucket_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    window_start DATETIME(6) NOT NULL,
    attempts INT NOT NULL,
    CONSTRAINT ck_rate_attempts CHECK (attempts >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
