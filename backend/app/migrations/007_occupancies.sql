CREATE TABLE occupancies (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, unit_id BIGINT NOT NULL,
 started_at DATETIME(6) NOT NULL, ended_at DATETIME(6), created_at DATETIME(6) NOT NULL,
 active_unit_id BIGINT GENERATED ALWAYS AS (CASE WHEN ended_at IS NULL THEN unit_id ELSE NULL END) STORED UNIQUE,
 FOREIGN KEY (unit_id) REFERENCES units(id), CHECK (ended_at IS NULL OR ended_at >= started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

