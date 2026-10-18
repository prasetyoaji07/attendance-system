export const ROLES = ['EMPLOYEE', 'FOREMAN', 'SPV', 'HRD', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const ATTENDANCE_STATUS = [
  'HADIR', 'TELAT', 'PULANG_CEPAT', 'ALPA', 'IZIN', 'SAKIT', 'CUTI', 'LEMBUR', 'LIBUR',
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUS)[number];

export const REQUEST_STATUS = ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;
export type RequestStatus = (typeof REQUEST_STATUS)[number];

export const REQUEST_TYPE = ['CUTI', 'IZIN', 'SAKIT', 'LEMBUR', 'TUKAR_SHIFT', 'KOREKSI_ABSEN'] as const;
export type RequestType = (typeof REQUEST_TYPE)[number];
