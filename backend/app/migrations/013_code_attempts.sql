CREATE TABLE code_attempts (
 user_id BIGINT NOT NULL, purpose VARCHAR(10) NOT NULL, failures INT NOT NULL DEFAULT 0, blocked_until DATETIME(6),
 PRIMARY KEY (user_id,purpose), FOREIGN KEY (user_id) REFERENCES users(id),
 CHECK (purpose IN ('invite','pickup')), CHECK (failures BETWEEN 0 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

