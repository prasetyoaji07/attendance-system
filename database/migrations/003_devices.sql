-- 003_devices.sql: device binding (Fase 2). Satu baris per perangkat per akun.
-- status: 'active' = boleh dipakai absen; 'pending' = menunggu persetujuan HRD/ADMIN.
-- UNIQUE(user_id, device_id): perangkat yang sama tidak bisa terdaftar dua kali untuk satu akun.

CREATE TABLE IF NOT EXISTS devices (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  device_id   VARCHAR(64) NOT NULL,
  status      ENUM('active','pending') NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_devices_user_device (user_id, device_id),
  KEY idx_devices_status (status),
  CONSTRAINT fk_devices_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
