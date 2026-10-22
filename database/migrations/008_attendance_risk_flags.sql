-- 008_attendance_risk_flags.sql: penanda risiko, teks kode dipisah koma (mis. 'NO_QR').
-- Nullable: NULL = tidak ada flag. Rule pola lain menyusul di Fase 5.

ALTER TABLE attendance ADD COLUMN risk_flags VARCHAR(100) NULL AFTER review_status;
