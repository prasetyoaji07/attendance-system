export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
  static badRequest(message: string, details?: unknown) { return new AppError(400, 'BAD_REQUEST', message, details); }
  static unauthorized(message = 'Belum login') { return new AppError(401, 'UNAUTHORIZED', message); }
  static forbidden(message = 'Tidak punya akses') { return new AppError(403, 'FORBIDDEN', message); }
  static notFound(message = 'Data tidak ditemukan') { return new AppError(404, 'NOT_FOUND', message); }
  static conflict(message: string) { return new AppError(409, 'CONFLICT', message); }
}
