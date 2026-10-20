import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  label: string;
  /** '' = belum memilih (tampil placeholder). */
  value: T | '';
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
}

/** Ruang minimal di bawah kolom supaya daftar muncul ke bawah di desktop; kurang dari ini daftar membuka ke atas (logika, bukan gaya). */
const SPACE_NEEDED = 280;

/*
 * design.md 9.4 (kolom: tinggi 48, radius-md, fokus border primary-500 + ring 3px primary-200),
 * 9.8 (bottom sheet di HP) dan z-index 8 (dropdown 30, bottom sheet 40).
 * Pengecualian token: warna overlay rgba(11,13,20,0.5) disalin dari ui/ConfirmDialog.
 *
 * HP: daftar jadi bottom sheet menempel di bawah layar (tidak bisa keluar layar).
 * Desktop (md+): popover di bawah kolom (atau di atas kalau ruang bawah sempit), tinggi dibatasi dan bisa di-scroll.
 */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Pilih',
  disabled = false,
}: Props<T>) {
  const uid = useId();
  const triggerId = `${uid}-trigger`;
  const labelId = `${uid}-label`;
  const listId = `${uid}-list`;
  const optionId = (i: number) => `${uid}-opt-${i}`;

  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [dropUp, setDropUp] = useState(false);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  function openList() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const below = window.innerHeight - rect.bottom;
      setDropUp(below < SPACE_NEEDED && rect.top > below);
    }
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }

  function choose(i: number) {
    const opt = options[i];
    if (!opt) return;
    onChange(opt.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  // Pilihan yang aktif selalu terlihat di dalam daftar.
  useEffect(() => {
    if (!open) return;
    document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openList();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive((a) => Math.min(a + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
        break;
      case 'Home':
        e.preventDefault();
        setActive(0);
        break;
      case 'End':
        e.preventDefault();
        setActive(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        choose(active);
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  }

  const desktopPos = dropUp ? 'md:bottom-full md:top-auto md:mb-2' : 'md:bottom-auto md:top-full md:mt-2';

  return (
    <div className="relative flex flex-col gap-2">
      <label id={labelId} htmlFor={triggerId} className="text-caption font-semibold text-muted">
        {label}
      </label>

      <button
        ref={triggerRef}
        type="button"
        id={triggerId}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? optionId(active) : undefined}
        aria-labelledby={`${labelId} ${triggerId}`}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={`flex h-12 w-full items-center justify-between gap-3 rounded-md border bg-surface px-4 text-left text-body transition-shadow focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-200 focus-visible:border-primary-500 disabled:opacity-50 ${
          open ? 'border-primary-500 ring-[3px] ring-primary-200' : 'border-border'
        } ${selected ? 'text-text' : 'text-faint'}`}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown
          size={20}
          strokeWidth={1.75}
          className={`shrink-0 text-muted transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <>
          {/* Penutup: klik di luar menutup daftar. Gelap di HP, bening di desktop. */}
          <div
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-[rgba(11,13,20,0.5)] backdrop-blur-sm md:z-30 md:bg-transparent md:backdrop-blur-none"
            onClick={() => setOpen(false)}
          />
          <div
            className={`fixed inset-x-0 bottom-0 z-40 max-h-[70vh] overflow-y-auto rounded-t-xl bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] shadow-4 md:absolute md:z-30 md:max-h-60 md:rounded-md md:border md:border-border md:p-1 md:pb-1 ${desktopPos}`}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border md:hidden" aria-hidden="true" />
            <p className="mb-2 text-h3 text-text md:hidden" aria-hidden="true">
              {label}
            </p>
            <ul id={listId} role="listbox" aria-labelledby={labelId} className="flex flex-col gap-1">
              {options.map((o, i) => {
                const isSelected = o.value === value;
                return (
                  <li
                    key={o.value}
                    id={optionId(i)}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => choose(i)}
                    onMouseEnter={() => setActive(i)}
                    className={`flex min-h-11 cursor-pointer select-none items-center justify-between gap-3 rounded-md px-3 text-body ${
                      i === active ? 'bg-primary-50' : ''
                    } ${isSelected ? 'font-semibold text-primary-600' : 'text-text'}`}
                  >
                    <span>{o.label}</span>
                    {isSelected && <Check size={20} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />}
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
