-- 006_attendance_check_out_method.sql: jalur absen pulang ('QR' / 'NO_QR').
-- Nullable: NULL = belum check-out, atau check-out lama sebelum kolom ini ada.

ALTER TABLE attendance ADD COLUMN check_out_method VARCHAR(10) NULL AFTER check_in_method;
