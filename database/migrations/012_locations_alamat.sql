-- 012_locations_alamat.sql: alamat lokasi kerja (satu teks: desa, kecamatan, kota/kab), dicetak di foto selfie.
-- Nullable: NULL = belum diisi (foto selfie tidak mencetak baris alamat).

ALTER TABLE locations ADD COLUMN alamat VARCHAR(200) NULL AFTER radius_m;
