CREATE TABLE unit_invite_codes (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, occupancy_id BIGINT NOT NULL, code_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 expires_at DATETIME(6) NOT NULL, disabled_at DATETIME(6), released_at DATETIME(6), created_by BIGINT NOT NULL, created_at DATETIME(6) NOT NULL,
 active_code_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin GENERATED ALWAYS AS (CASE WHEN disabled_at IS NULL AND released_at IS NULL THEN code_hash ELSE NULL END) STORED UNIQUE,
 active_occupancy_id BIGINT GENERATED ALWAYS AS (CASE WHEN disabled_at IS NULL AND released_at IS NULL THEN occupancy_id ELSE NULL END) STORED UNIQUE,
 FOREIGN KEY (occupancy_id) REFERENCES occupancies(id), FOREIGN KEY (created_by) REFERENCES users(id),
 INDEX (code_hash,expires_at), CHECK (expires_at > created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

