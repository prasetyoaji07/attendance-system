-- 005_attendance_check_in_method.sql: jalur absen masuk (Fase 2b, absen tanpa QR).
-- Nilai: 'QR' atau 'NO_QR'. Baris lama otomatis 'QR' (sebelum Fase 2b semua absen memakai QR).
-- VARCHAR (bukan ENUM) supaya menambah jalur baru nanti tidak perlu ALTER; validasi dijaga kode server.
-- Satu ALTER per file agar aman di MySQL maupun TiDB (DDL tidak bisa di-rollback bila gagal di tengah).

ALTER TABLE attendance ADD COLUMN check_in_method VARCHAR(10) NOT NULL DEFAULT 'QR' AFTER status;
