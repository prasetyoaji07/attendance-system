-- 002_attendance_checkout.sql: kolom untuk check-out dan penutupan otomatis (Fase 2).
-- Satu perubahan per ALTER agar aman di MySQL maupun TiDB.

ALTER TABLE attendance ADD COLUMN early_leave_minutes INT UNSIGNED NOT NULL DEFAULT 0 AFTER late_minutes;

-- 1 = ditutup otomatis karena tidak ada check-out setelah batas waktu (check_out_at tetap kosong).
ALTER TABLE attendance ADD COLUMN auto_closed TINYINT(1) NOT NULL DEFAULT 0 AFTER status;

-- 1 = perlu dikoreksi lewat pengajuan koreksi absen (antrean HRD, Fase 3).
ALTER TABLE attendance ADD COLUMN needs_correction TINYINT(1) NOT NULL DEFAULT 0 AFTER auto_closed;

-- Mempercepat pencarian absen yang masih terbuka (check_out_at kosong dan belum ditutup).
ALTER TABLE attendance ADD KEY idx_attendance_open (check_out_at, auto_closed);
