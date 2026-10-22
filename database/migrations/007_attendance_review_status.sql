-- 007_attendance_review_status.sql: status tinjauan HRD (docs/alur.md 7.1b).
-- Nilai: NOT_REQUIRED / PENDING / SESUAI / MENCURIGAKAN. Baris lama = NOT_REQUIRED.

ALTER TABLE attendance ADD COLUMN review_status VARCHAR(15) NOT NULL DEFAULT 'NOT_REQUIRED' AFTER check_out_method;
