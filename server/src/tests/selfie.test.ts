import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { AppError } from '../core/errors';
import { RULES } from '../core/rules';
import { checkInSchema, checkOutSchema } from '../modules/attendance/attendance.schema';
import { decodeSelfie, MAX_SELFIE_BASE64_CHARS, selfieExpiry } from '../modules/attendance/selfie';
import { createDiskSelfieStorage } from '../modules/attendance/selfie-storage';
import { fakeJpegBase64, fakeJpegBytes } from './selfie-fixture';

function catchErr(fn: () => unknown): AppError {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(AppError);
    return e as AppError;
  }
  throw new Error('seharusnya melempar error');
}

describe('decodeSelfie', () => {
  it('menerima base64 JPEG polos dan yang berawalan data URL', () => {
    const bytes = fakeJpegBytes(1500);
    expect(decodeSelfie(bytes.toString('base64')).equals(bytes)).toBe(true);
    expect(decodeSelfie(`data:image/jpeg;base64,${bytes.toString('base64')}`).equals(bytes)).toBe(true);
  });

  it('kosong atau tidak dikirim: 422 SELFIE_REQUIRED', () => {
    expect(catchErr(() => decodeSelfie(undefined)).code).toBe('SELFIE_REQUIRED');
    expect(catchErr(() => decodeSelfie('   ')).code).toBe('SELFIE_REQUIRED');
    expect(catchErr(() => decodeSelfie(undefined)).status).toBe(422);
  });

  it('bukan base64: 422 SELFIE_INVALID', () => {
    expect(catchErr(() => decodeSelfie('ini bukan base64!!')).code).toBe('SELFIE_INVALID');
  });

  it('bukan JPEG (mis. PNG): SELFIE_INVALID', () => {
    const png = Buffer.alloc(1200, 1);
    png[0] = 0x89;
    png[1] = 0x50;
    png[2] = 0x4e;
    png[3] = 0x47;
    const err = catchErr(() => decodeSelfie(png.toString('base64')));
    expect(err.code).toBe('SELFIE_INVALID');
    expect(err.message).toContain('JPEG');
  });

  it('terlalu besar atau terlalu kecil: SELFIE_INVALID; tepat di batas besar masih diterima', () => {
    expect(catchErr(() => decodeSelfie(fakeJpegBase64(RULES.maxSelfieBytes + 1))).code).toBe('SELFIE_INVALID');
    expect(catchErr(() => decodeSelfie(fakeJpegBase64(50))).code).toBe('SELFIE_INVALID');
    expect(decodeSelfie(fakeJpegBase64(RULES.maxSelfieBytes)).length).toBe(RULES.maxSelfieBytes);
  });
});

describe('selfieExpiry', () => {
  it('= saat diambil + masa simpan (30 hari)', () => {
    const t = new Date('2026-03-02T06:00:00Z');
    expect(selfieExpiry(t).getTime() - t.getTime()).toBe(RULES.selfieRetentionDays * 86_400_000);
    expect(RULES.selfieRetentionDays).toBe(30);
  });
});

describe('schema check-in/check-out: jalur tanpa QR', () => {
  const base = { lat: -6.2, lng: 106.8, accuracyM: 12 };

  it('qr boleh tidak dikirim (jalur tanpa QR), selfie opsional di schema', () => {
    expect(checkInSchema.safeParse(base).success).toBe(true);
    expect(checkInSchema.safeParse({ ...base, selfie: fakeJpegBase64() }).success).toBe(true);
    expect(checkOutSchema.safeParse(base).success).toBe(true);
  });

  it('qr yang dikirim tetapi kosong tetap ditolak', () => {
    expect(checkInSchema.safeParse({ ...base, qr: '' }).success).toBe(false);
    expect(checkOutSchema.safeParse({ ...base, qr: '' }).success).toBe(false);
  });

  it('selfie melebihi batas panjang ditolak di schema', () => {
    expect(checkInSchema.safeParse({ ...base, selfie: 'A'.repeat(MAX_SELFIE_BASE64_CHARS + 1) }).success).toBe(false);
  });
});

describe('penyimpanan selfie di disk', () => {
  let dir: string | undefined;
  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it('simpan, baca, hapus; hapus dua kali tidak error; file tidak ada = null', async () => {
    dir = await mkdtemp(join(tmpdir(), 'selfie-test-'));
    const storage = createDiskSelfieStorage(join(dir, 'sub'));
    const bytes = fakeJpegBytes(900);
    const ref = await storage.save(bytes);
    expect(ref).toMatch(/^[0-9a-f-]{36}\.jpg$/);
    expect((await storage.read(ref))?.equals(bytes)).toBe(true);
    await storage.remove(ref);
    expect(await storage.read(ref)).toBeNull();
    await expect(storage.remove(ref)).resolves.toBeUndefined();
  });

  it('file_ref yang mencoba keluar folder ditolak', async () => {
    dir = dir ?? (await mkdtemp(join(tmpdir(), 'selfie-test-')));
    const storage = createDiskSelfieStorage(dir);
    await expect(storage.read('../rahasia.txt')).rejects.toThrow();
    await expect(storage.remove('..\\rahasia.txt')).rejects.toThrow();
  });
});
