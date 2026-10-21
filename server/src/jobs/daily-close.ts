/**
 * FASE 4: penutupan harian. Lihat docs/alur.md bagian 7.2.
 * Untuk tiap roster yang shift-nya selesai dan periode OPEN:
 *  - attendance lengkap -> finalisasi HADIR/TELAT/PULANG_CEPAT
 *  - check-in tanpa check-out -> auto-close + flag perlu koreksi
 *  - tidak ada attendance -> cuti/izin/sakit APPROVED, atau LIBUR, selain itu ALPA
 * Harus idempotent (aman dijalankan dua kali).
 */
export async function runDailyClose(): Promise<void> {
  console.log('[daily-close] dilewati: penutupan harian belum dibuat (Fase 4), tidak ada data yang diubah');
}
