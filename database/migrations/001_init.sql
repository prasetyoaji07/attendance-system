-- 001_init.sql: skema Fase 1 (master data, roster, attendance, audit log)
-- Sumber: docs/alur.md bagian 5. Semua data adalah SIMULASI.
-- Waktu disimpan UTC (DATETIME). Kolom TIME pada `shifts` adalah jam dinding WIB.

SET NAMES utf8mb4;

-- ---------- Master ----------

CREATE TABLE IF NOT EXISTS departments (
  id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nama      VARCHAR(100) NOT NULL,
  kepala_id BIGINT UNSIGNED NULL,               -- FK ke employees ditambah di akhir file (referensi melingkar)
  PRIMARY KEY (id),
  UNIQUE KEY uq_departments_nama (nama)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS employees (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nik            VARCHAR(30) NOT NULL,
  nama           VARCHAR(150) NOT NULL,
  department_id  BIGINT UNSIGNED NOT NULL,
  atasan_id      BIGINT UNSIGNED NULL,
  tanggal_masuk  DATE NOT NULL,
  aktif          TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_employees_nik (nik),
  KEY idx_employees_department (department_id),
  KEY idx_employees_atasan (atasan_id),
  CONSTRAINT fk_employees_department FOREIGN KEY (department_id) REFERENCES departments (id),
  CONSTRAINT fk_employees_atasan FOREIGN KEY (atasan_id) REFERENCES employees (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id    BIGINT UNSIGNED NOT NULL,
  password_hash  VARCHAR(100) NOT NULL,
  role           ENUM('EMPLOYEE','FOREMAN','SPV','HRD','ADMIN') NOT NULL DEFAULT 'EMPLOYEE',
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_employee (employee_id),
  CONSTRAINT fk_users_employee FOREIGN KEY (employee_id) REFERENCES employees (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS locations (
  id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nama      VARCHAR(100) NOT NULL,
  lat       DECIMAL(10,7) NOT NULL,
  lng       DECIMAL(10,7) NOT NULL,
  radius_m  INT UNSIGNED NOT NULL DEFAULT 100,
  PRIMARY KEY (id),
  UNIQUE KEY uq_locations_nama (nama)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shifts (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nama             VARCHAR(50) NOT NULL,
  jam_mulai        TIME NOT NULL,
  jam_selesai      TIME NOT NULL,
  lintas_hari      TINYINT(1) NOT NULL DEFAULT 0,   -- 1 jika selesai di hari berikutnya (mis. malam 22:00-06:00)
  toleransi_menit  SMALLINT UNSIGNED NOT NULL DEFAULT 5,
  PRIMARY KEY (id),
  UNIQUE KEY uq_shifts_nama (nama)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shift_patterns (
  id      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nama    VARCHAR(100) NOT NULL,
  urutan  JSON NOT NULL,                            -- contoh: ["pagi","pagi","siang","siang","malam","malam","libur","libur"]
  PRIMARY KEY (id),
  UNIQUE KEY uq_shift_patterns_nama (nama)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS holidays (
  id       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tanggal  DATE NOT NULL,
  nama     VARCHAR(150) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_holidays_tanggal (tanggal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS leave_types (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nama             VARCHAR(100) NOT NULL,
  kuota_tahunan    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  butuh_lampiran   TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_leave_types_nama (nama)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Transaksi ----------

-- Hari libur tidak punya baris roster (tidak ada roster = tidak wajib hadir).
CREATE TABLE IF NOT EXISTS rosters (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id  BIGINT UNSIGNED NOT NULL,
  shift_date   DATE NOT NULL,                       -- tanggal MULAI shift (shift malam = hari mulainya)
  shift_id     BIGINT UNSIGNED NOT NULL,
  location_id  BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rosters_employee_date (employee_id, shift_date),
  KEY idx_rosters_date (shift_date),
  CONSTRAINT fk_rosters_employee FOREIGN KEY (employee_id) REFERENCES employees (id),
  CONSTRAINT fk_rosters_shift FOREIGN KEY (shift_id) REFERENCES shifts (id),
  CONSTRAINT fk_rosters_location FOREIGN KEY (location_id) REFERENCES locations (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attendance (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  roster_id      BIGINT UNSIGNED NOT NULL,
  check_in_at    DATETIME NULL,                     -- UTC
  check_out_at   DATETIME NULL,                     -- UTC
  lat_in         DECIMAL(10,7) NULL,
  lng_in         DECIMAL(10,7) NULL,
  lat_out        DECIMAL(10,7) NULL,
  lng_out        DECIMAL(10,7) NULL,
  distance_m     DECIMAL(8,2) NULL,
  accuracy_m     DECIMAL(8,2) NULL,
  late_minutes   INT UNSIGNED NOT NULL DEFAULT 0,
  status         ENUM('HADIR','TELAT','PULANG_CEPAT','ALPA','IZIN','SAKIT','CUTI','LEMBUR','LIBUR') NOT NULL DEFAULT 'HADIR',
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_attendance_roster (roster_id),      -- satu roster hanya satu check-in (aturan 3)
  CONSTRAINT fk_attendance_roster FOREIGN KEY (roster_id) REFERENCES rosters (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Sistem ----------

-- Kolom sesuai core/audit.ts (writeAudit).
CREATE TABLE IF NOT EXISTS audit_logs (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      BIGINT UNSIGNED NULL,
  action       VARCHAR(50) NOT NULL,
  entity       VARCHAR(50) NOT NULL,
  entity_id    VARCHAR(64) NOT NULL,
  before_json  JSON NULL,
  after_json   JSON NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_entity (entity, entity_id),
  KEY idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Referensi melingkar (harus paling akhir) ----------

ALTER TABLE departments
  ADD CONSTRAINT fk_departments_kepala FOREIGN KEY (kepala_id) REFERENCES employees (id);
