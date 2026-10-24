CREATE TABLE parcel_pickups (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, parcel_id BIGINT NOT NULL UNIQUE, verification_id BIGINT NOT NULL UNIQUE,
 picked_up_by BIGINT NOT NULL, picked_up_at DATETIME(6) NOT NULL,
 picked_up_by_name_snapshot VARCHAR(100) NOT NULL, handled_by_name_snapshot VARCHAR(100) NOT NULL,
 FOREIGN KEY (verification_id,parcel_id) REFERENCES pickup_verifications(id,parcel_id),
 FOREIGN KEY (parcel_id) REFERENCES parcels(id), FOREIGN KEY (picked_up_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

