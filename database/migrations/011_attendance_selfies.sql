-- 011_attendance_selfies.sql: metadata selfie absen tanpa QR. Gambar TIDAK disimpan di tabel, hanya rujukan file (file_ref).
-- Satu selfie per absen per jenis (IN / OUT). expires_at = captured_at + 30 hari, lalu dihapus skrip purge-selfies.

CREATE TABLE IF NOT EXISTS attendance_selfies (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  attendance_id  BIGINT UNSIGNED NOT NULL,
  jenis          VARCHAR(3) NOT NULL,
  file_ref       VARCHAR(100) NOT NULL,
  captured_at    DATETIME NOT NULL,
  expires_at     DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_attendance_selfies_attendance_jenis (attendance_id, jenis),
  KEY idx_attendance_selfies_expires (expires_at),
  CONSTRAINT fk_attendance_selfies_attendance FOREIGN KEY (attendance_id) REFERENCES attendance (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
