import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EARLY_LEAVE_REASON_LABELS, EARLY_LEAVE_REASONS } from '../core/early-leave-reasons';

/**
 * Client menyalin daftar alasan pulang awal ke client/src/features/attendance/earlyLeave.ts.
 * Tes ini membaca teks file itu dan membandingkannya dengan sumber server, supaya salinan
 * tidak diam-diam menyimpang (mis. server menambah alasan, dropdown client belum ikut).
 */
const CLIENT_FILE = resolve(__dirname, '../../../client/src/features/attendance/earlyLeave.ts');

function readClient() {
  // Buang komentar supaya kata di dalam komentar tidak ikut terbaca.
  const text = readFileSync(CLIENT_FILE, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  const listBody = /EARLY_LEAVE_REASONS\s*=\s*\[([\s\S]*?)\]\s*as const/.exec(text)?.[1];
  const labelsBody = /EARLY_LEAVE_REASON_LABELS[^=]*=\s*\{([\s\S]*?)\}\s*;/.exec(text)?.[1];
  if (listBody === undefined || labelsBody === undefined) {
    throw new Error('Format earlyLeave.ts di client tidak terbaca; sesuaikan pola di early-leave-sync.test.ts');
  }

  const codes = [...listBody.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const labels: Record<string, string> = {};
  for (const m of labelsBody.matchAll(/(\w+)\s*:\s*'([^']*)'/g)) labels[m[1]] = m[2];
  return { codes, labels };
}

describe('client/earlyLeave.ts sama dengan server/core/early-leave-reasons.ts', () => {
  const client = readClient();

  it('daftar kode sama persis, urutan juga (urutan = urutan dropdown)', () => {
    expect(client.codes).toEqual([...EARLY_LEAVE_REASONS]);
  });

  it('label tiap kode sama persis', () => {
    expect(client.labels).toEqual(EARLY_LEAVE_REASON_LABELS);
  });
});
