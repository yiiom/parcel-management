CREATE TABLE units (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, building_id BIGINT NOT NULL, floor VARCHAR(20) NOT NULL,
 unit_number VARCHAR(20) NOT NULL, created_at DATETIME(6) NOT NULL, updated_at DATETIME(6) NOT NULL,
 UNIQUE (building_id,unit_number), FOREIGN KEY (building_id) REFERENCES buildings(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

