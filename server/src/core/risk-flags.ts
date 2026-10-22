/** Nilai tetap untuk absen tanpa QR dan tinjauan HRD (docs/alur.md 5.2 dan 7.1b). */

export const CHECK_METHODS = ['QR', 'NO_QR'] as const;
export type CheckMethod = (typeof CHECK_METHODS)[number];

export const REVIEW_STATUSES = ['NOT_REQUIRED', 'PENDING', 'SESUAI', 'MENCURIGAKAN'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/** Keputusan yang boleh dipilih peninjau (PENDING dan NOT_REQUIRED hanya diset sistem). */
export const REVIEW_DECISIONS = ['SESUAI', 'MENCURIGAKAN'] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

/** Rule pola (lokasi melompat, koordinat identik berulang) menyusul di Fase 5. */
export const RISK_FLAGS = ['NO_QR'] as const;
export type RiskFlag = (typeof RISK_FLAGS)[number];

/** Gabung flag jadi teks kolom risk_flags; null jika kosong. */
export const joinRiskFlags = (flags: readonly RiskFlag[]): string | null => (flags.length > 0 ? flags.join(',') : null);
