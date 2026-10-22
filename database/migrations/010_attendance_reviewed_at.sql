-- 010_attendance_reviewed_at.sql: waktu tinjauan (UTC).

ALTER TABLE attendance ADD COLUMN reviewed_at DATETIME NULL AFTER reviewed_by;
