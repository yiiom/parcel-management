CREATE TABLE pickup_verifications (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, parcel_id BIGINT NOT NULL, verified_by BIGINT NOT NULL,
 verified_at DATETIME(6) NOT NULL, expires_at DATETIME(6) NOT NULL, status VARCHAR(30) NOT NULL, updated_at DATETIME(6) NOT NULL,
 active_parcel_id BIGINT GENERATED ALWAYS AS (CASE WHEN status='awaiting_confirmation' THEN parcel_id ELSE NULL END) STORED UNIQUE,
 UNIQUE (id,parcel_id), FOREIGN KEY (parcel_id) REFERENCES parcels(id), FOREIGN KEY (verified_by) REFERENCES users(id),
 CHECK (status IN ('awaiting_confirmation','completed','expired','cancelled')), CHECK (expires_at > verified_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

