CREATE TABLE unit_memberships (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, user_id BIGINT NOT NULL, occupancy_id BIGINT NOT NULL,
 status VARCHAR(20) NOT NULL, joined_at DATETIME(6) NOT NULL, exit_requested_at DATETIME(6),
 left_at DATETIME(6), revoked_by BIGINT,
 active_user_id BIGINT GENERATED ALWAYS AS (CASE WHEN status IN ('active','exit_requested') THEN user_id ELSE NULL END) STORED UNIQUE,
 CHECK (status IN ('active','exit_requested','revoked')),
 FOREIGN KEY (user_id) REFERENCES users(id), FOREIGN KEY (occupancy_id) REFERENCES occupancies(id),
 FOREIGN KEY (revoked_by) REFERENCES users(id), INDEX (occupancy_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

