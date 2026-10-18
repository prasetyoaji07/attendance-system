/**
 * Placeholder loading berbentuk konten asli (design.md 9.10).
 * Memakai animate-pulse bawaan Tailwind; prefers-reduced-motion sudah
 * dimatikan global lewat tokens.css. Atur ukuran lewat className.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-sm bg-surface-2 ${className}`} />;
}
