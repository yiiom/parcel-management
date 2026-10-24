CREATE TABLE parcels (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, occupancy_id BIGINT NOT NULL,
 recipient_name VARCHAR(100) NOT NULL, courier VARCHAR(100), tracking_number VARCHAR(100),
 storage_location VARCHAR(100), note LONGTEXT, status VARCHAR(20) NOT NULL,
 pickup_code_encrypted VARCHAR(255) NOT NULL, pickup_code_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 code_building_id BIGINT NOT NULL,
 active_code_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin GENERATED ALWAYS AS (CASE WHEN status='pending' THEN pickup_code_hash ELSE NULL END) STORED,
 created_by BIGINT NOT NULL, created_at DATETIME(6) NOT NULL, updated_at DATETIME(6) NOT NULL,
 exception_reason LONGTEXT, exception_reported_by BIGINT, exception_reported_at DATETIME(6),
 resolution_note LONGTEXT, resolved_by BIGINT, resolved_at DATETIME(6),
 UNIQUE (code_building_id,active_code_hash), INDEX (occupancy_id,created_at,id),
 INDEX (courier,tracking_number), CHECK (status IN ('pending','picked_up','exception','returned')),
 FOREIGN KEY (occupancy_id) REFERENCES occupancies(id), FOREIGN KEY (code_building_id) REFERENCES buildings(id),
 FOREIGN KEY (created_by) REFERENCES users(id), FOREIGN KEY (exception_reported_by) REFERENCES users(id),
 FOREIGN KEY (resolved_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

