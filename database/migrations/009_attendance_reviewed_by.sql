-- 009_attendance_reviewed_by.sql: users.id peninjau (HRD/ADMIN). Tanpa FOREIGN KEY, sama seperti kolom catatan lain.

ALTER TABLE attendance ADD COLUMN reviewed_by BIGINT UNSIGNED NULL AFTER risk_flags;
