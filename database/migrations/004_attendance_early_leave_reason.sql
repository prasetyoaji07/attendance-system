-- 004_attendance_early_leave_reason.sql: alasan pulang sebelum jam selesai shift (C0b).
-- Nullable: baris lama dan check-out yang tidak perlu alasan tetap NULL.
-- VARCHAR (bukan ENUM) supaya menambah alasan baru nanti tidak perlu ALTER; validasi dijaga zod di server.
-- Satu ALTER saja agar aman di MySQL maupun TiDB.

ALTER TABLE attendance ADD COLUMN early_leave_reason VARCHAR(30) NULL AFTER early_leave_minutes;
