import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, MoonStar } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dayjs, hhmm, ISO } from '@/lib/date';

interface RosterItem {
  id: number;
  employeeId: number;
  employeeNama: string;
  shiftDate: string;
  shiftNama: string;
  jamMulai: string;
  jamSelesai: string;
  lintasHari: boolean;
  locationNama: string;
}
interface Holiday {
  tanggal: string;
  nama: string;
}
interface EmployeeOption {
  id: number;
  nik: string;
  nama: string;
}

/** Warna per shift memakai token desain (terang dan gelap ikut otomatis). */
const SHIFT_STYLE: Record<string, { color: string; bg: string; short: string }> = {
  pagi: { color: 'var(--warning)', bg: 'var(--warning-bg)', short: 'P' },
  siang: { color: 'var(--info)', bg: 'var(--info-bg)', short: 'S' },
  malam: { color: 'var(--violet)', bg: 'var(--violet-bg)', short: 'M' },
  reguler: { color: 'var(--teal)', bg: 'var(--teal-bg)', short: 'R' },
};
const FALLBACK_STYLE = { color: 'var(--slate)', bg: 'var(--slate-bg)', short: '?' };
const styleOf = (nama: string) => SHIFT_STYLE[nama.toLowerCase()] ?? FALLBACK_STYLE;

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

export default function Schedule() {
  const { user } = useAuth();
  const canPick = user !== null && user.role !== 'EMPLOYEE';
  const [month, setMonth] = useState(() => dayjs().startOf('month'));
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [selected, setSelected] = useState<string>(() => dayjs().format(ISO));

  const targetId = employeeId ?? user?.employeeId ?? 0;
  const monthStart = month.startOf('month');
  const monthEnd = month.endOf('month');
  // Mulai sehari lebih awal: shift malam di hari terakhir bulan lalu masih berakhir di tanggal 1.
  const from = monthStart.subtract(1, 'day').format(ISO);
  const to = monthEnd.format(ISO);

  const roster = useQuery({
    queryKey: ['roster', targetId, from, to],
    queryFn: () => api<{ data: RosterItem[] }>(`/roster?from=${from}&to=${to}&employeeId=${targetId}`),
    enabled: targetId > 0,
    placeholderData: keepPreviousData,
  });
  const holidays = useQuery({
    queryKey: ['holidays', from, to],
    queryFn: () => api<{ data: Holiday[] }>(`/holidays?from=${from}&to=${to}`),
    placeholderData: keepPreviousData,
  });
  const employees = useQuery({
    queryKey: ['employee-options'],
    queryFn: () => api<{ data: EmployeeOption[] }>('/employees?limit=100'),
    enabled: canPick,
  });

  // Data dianggap siap hanya bila kedua query sukses untuk bulan yang sedang dilihat
  // (bukan data bulan/karyawan sebelumnya yang dipinjam oleh keepPreviousData).
  const failed = roster.isError || holidays.isError;
  const dataReady =
    roster.isSuccess && holidays.isSuccess && !roster.isPlaceholderData && !holidays.isPlaceholderData;
  const pending = !dataReady && !failed;

  const targetName =
    targetId === user?.employeeId
      ? user?.nama
      : (employees.data?.data ?? []).find((e) => e.id === targetId)?.nama ?? '';

  const rosterByDate = useMemo(
    () => new Map((dataReady ? (roster.data?.data ?? []) : []).map((r) => [r.shiftDate, r])),
    [dataReady, roster.data],
  );
  const holidayByDate = useMemo(
    () => new Map((dataReady ? (holidays.data?.data ?? []) : []).map((h) => [h.tanggal, h])),
    [dataReady, holidays.data],
  );

  // Sel kalender, Senin sebagai hari pertama.
  const cells = useMemo(() => {
    const lead = (monthStart.day() + 6) % 7;
    const days = Array.from({ length: monthStart.daysInMonth() }, (_, i) => monthStart.add(i, 'day').format(ISO));
    return [...Array<null>(lead).fill(null), ...days];
  }, [monthStart]);

  const stats = useMemo(() => {
    let kerja = 0;
    let malam = 0;
    let libur = 0;
    let liburNasional = 0;
    for (const date of cells) {
      if (!date) continue;
      const r = rosterByDate.get(date);
      const h = holidayByDate.get(date);
      if (h) liburNasional++;
      if (r && !h) {
        kerja++;
        if (r.lintasHari) malam++;
      } else if (!h) libur++;
    }
    return { kerja, malam, libur, liburNasional };
  }, [cells, rosterByDate, holidayByDate]);

  const employeeOptions = [
    { value: String(user?.employeeId ?? 0), label: `Saya (${user?.nik ?? ''})` },
    ...(employees.data?.data ?? [])
      .filter((e) => e.id !== user?.employeeId)
      .map((e) => ({ value: String(e.id), label: `${e.nik} · ${e.nama}` })),
  ];

  const today = dayjs().format(ISO);
  const hasData = dataReady && (roster.data?.data ?? []).length > 0;
  const selRoster = rosterByDate.get(selected);
  const selHoliday = holidayByDate.get(selected);
  const selPrev = rosterByDate.get(dayjs(selected).subtract(1, 'day').format(ISO));

  function go(delta: number) {
    const next = month.add(delta, 'month');
    setMonth(next);
    setSelected(next.startOf('month').format(ISO));
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>Jadwal</h1>
          <p className="text-muted">{targetName}</p>
        </div>
        {canPick && (
          <div className="w-full sm:w-72">
            <Select
              label="Karyawan"
              value={String(targetId)}
              onChange={(v) => setEmployeeId(Number(v))}
              options={employeeOptions}
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Button variant="secondary" size="sm" onClick={() => go(-1)} aria-label="Bulan sebelumnya">
            <ChevronLeft size={20} strokeWidth={1.75} />
          </Button>
          <h2 className="flex-1 whitespace-nowrap text-center capitalize">{month.format('MMMM YYYY')}</h2>
          <Button variant="secondary" size="sm" onClick={() => go(1)} aria-label="Bulan berikutnya">
            <ChevronRight size={20} strokeWidth={1.75} />
          </Button>
        </div>
        {!month.isSame(dayjs(), 'month') && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setMonth(dayjs().startOf('month'));
                setSelected(today);
              }}
            >
              Hari ini
            </Button>
          </div>
        )}
      </div>

      {failed && (
        <div role="alert" className="card flex flex-col gap-3 border-danger">
          <p className="text-danger">
            Jadwal gagal dimuat. {roster.error instanceof Error ? roster.error.message : ''}
          </p>
          <div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void roster.refetch();
                void holidays.refetch();
              }}
            >
              Coba lagi
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Hari kerja" value={hasData ? stats.kerja : null} pending={pending} />
        <Stat label="Shift malam" value={hasData ? stats.malam : null} pending={pending} color="var(--violet)" />
        <Stat label="Libur nasional" value={dataReady ? stats.liburNasional : null} pending={pending} color="var(--danger)" />
        <Stat label="Libur rotasi" value={hasData ? stats.libur : null} pending={pending} />
      </div>

      <section aria-label="Kalender jadwal" aria-busy={pending} className={`card p-2 sm:p-4 ${pending ? 'animate-pulse' : ''}`}>
        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-caption text-muted">
          {WEEKDAYS.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((date, i) => {
            if (!date) return <div key={`b${i}`} />;
            const r = rosterByDate.get(date);
            const h = holidayByDate.get(date);
            const prev = rosterByDate.get(dayjs(date).subtract(1, 'day').format(ISO));
            const st = r ? styleOf(r.shiftNama) : null;
            const isSel = date === selected;
            const isToday = date === today;
            const dayLabel = dayjs(date).format('dddd D MMMM');
            return (
              <button
                key={date}
                type="button"
                onClick={() => setSelected(date)}
                aria-pressed={isSel}
                aria-label={dataReady ? `${dayLabel}: ${h ? h.nama : r ? r.shiftNama : 'libur'}` : dayLabel}
                className={`flex min-h-14 flex-col items-stretch gap-0.5 rounded-sm border p-1 text-left transition-colors md:min-h-24 md:p-2 ${
                  isSel ? 'border-primary-500 ring-2 ring-primary-200' : 'border-transparent hover:border-border'
                } ${h ? 'bg-[var(--danger-bg)]' : 'bg-surface-2'}`}
              >
                <span
                  className={`tabular text-caption font-bold ${h ? 'text-danger' : ''} ${
                    isToday ? 'inline-flex h-5 w-5 items-center justify-center self-start rounded-full bg-primary-500 text-white' : ''
                  }`}
                >
                  {dayjs(date).date()}
                </span>
                {r && st && (
                  <span
                    className={`flex items-center justify-center rounded-sm px-1 text-caption font-bold md:justify-start ${
                      h ? 'opacity-60' : ''
                    }`}
                    style={{ background: st.bg, color: st.color }}
                  >
                    <span className="md:hidden">{st.short}</span>
                    <span className="hidden truncate md:inline">{r.shiftNama}</span>
                    {r.lintasHari && <MoonStar size={12} className="ml-1 hidden shrink-0 md:inline" aria-hidden />}
                  </span>
                )}
                {r && (
                  <span className="tabular hidden text-caption text-muted md:block">
                    {hhmm(r.jamMulai)}–{hhmm(r.jamSelesai)}
                  </span>
                )}
                {!r && prev?.lintasHari && (
                  <span className="hidden text-caption text-muted md:block">↳ s/d {hhmm(prev.jamSelesai)}</span>
                )}
                {h && <span className="hidden truncate text-caption font-semibold text-danger md:block">{h.nama}</span>}
                {dataReady && !r && !h && !prev?.lintasHari && (
                  <span className="hidden text-caption text-faint md:block">Libur</span>
                )}
              </button>
            );
          })}
        </div>

        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted" aria-label="Keterangan warna">
          {Object.entries(SHIFT_STYLE).map(([name, s]) => (
            <li key={name} className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: s.color }} />
              <span className="capitalize">
                {s.short} = {name}
              </span>
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm bg-danger" /> Libur nasional
          </li>
        </ul>
      </section>

      {dataReady && !hasData && (
        <p className="card text-muted">Belum ada jadwal untuk bulan ini. Seed hanya mengisi 12 bulan terakhir sampai 30 hari ke depan.</p>
      )}

      <section aria-label="Detail hari" aria-busy={pending} className="card flex flex-col gap-2">
        <h3 className="capitalize">{dayjs(selected).format('dddd, D MMMM YYYY')}</h3>
        {!dataReady ? (
          pending ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
          ) : (
            <p className="text-muted">–</p>
          )
        ) : (
          <>
            {selHoliday && <p className="font-semibold text-danger">Libur nasional: {selHoliday.nama}</p>}
            {selRoster ? (
              <>
                <p className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-sm px-2 py-0.5 font-bold"
                    style={{ background: styleOf(selRoster.shiftNama).bg, color: styleOf(selRoster.shiftNama).color }}
                  >
                    {selRoster.shiftNama}
                  </span>
                  <span className="tabular font-mono">
                    {hhmm(selRoster.jamMulai)} - {hhmm(selRoster.jamSelesai)}
                  </span>
                </p>
                {selRoster.lintasHari && (
                  <p className="flex items-center gap-1.5 text-muted">
                    <MoonStar size={16} aria-hidden /> Shift malam: selesai besok pukul {hhmm(selRoster.jamSelesai)}.
                  </p>
                )}
                <p className="text-muted">Lokasi: {selRoster.locationNama}</p>
                {selHoliday && (
                  <p className="text-caption text-muted">
                    Ada roster di hari libur nasional; hari ini tidak dihitung sebagai hari kerja.
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted">{selHoliday ? 'Tidak ada roster.' : 'Libur sesuai rotasi, tidak ada shift.'}</p>
            )}
            {!selRoster && selPrev?.lintasHari && (
              <p className="flex items-center gap-1.5 text-muted">
                <MoonStar size={16} aria-hidden /> Lanjutan shift malam kemarin, selesai pukul {hhmm(selPrev.jamSelesai)}.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  pending,
  color,
}: {
  label: string;
  value: number | null;
  pending: boolean;
  color?: string;
}) {
  return (
    <div className="card flex flex-col gap-1 p-4">
      <span className="text-caption text-muted">{label}</span>
      {pending ? (
        <Skeleton className="h-8 w-12" />
      ) : (
        <span className="tabular text-h2" style={color ? { color } : undefined}>
          {value ?? '–'}
        </span>
      )}
    </div>
  );
}
