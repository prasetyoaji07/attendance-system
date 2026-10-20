/** Format waktu WIB sesuai design.md bagian 13: jam 24 jam "07:03", tanggal "Sen, 18 Okt 2026". */
const TIME = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const DATE = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function parts(fmt: Intl.DateTimeFormat, iso: string): Record<string, string> | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(d)) p[part.type] = part.value.replace(/\.$/, '');
  return p;
}

/** "13:21" (WIB). */
export function timeWib(iso: string): string {
  const p = parts(TIME, iso);
  return p ? `${p.hour}:${p.minute}` : '-';
}

/** "Sel, 20 Okt 2026" (WIB). */
export function dateWib(iso: string): string {
  const p = parts(DATE, iso);
  return p ? `${p.weekday}, ${p.day} ${p.month} ${p.year}` : '-';
}

/** Salam menurut jam WIB. */
export function greetingWib(iso: string): string {
  const p = parts(TIME, iso);
  const h = p ? Number(p.hour) : 12;
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 18) return 'Selamat sore';
  return 'Selamat malam';
}
