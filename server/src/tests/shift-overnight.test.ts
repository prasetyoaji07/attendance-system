import { describe, expect, it } from 'vitest';
import { isOvernight } from '../utils/shift-time';

describe('isOvernight', () => {
  it('shift normal bukan lintas hari', () => {
    expect(isOvernight('07:00', '15:00')).toBe(false);
    expect(isOvernight('00:00', '08:00')).toBe(false);
  });
  it('shift malam lintas hari', () => {
    expect(isOvernight('22:00', '06:00')).toBe(true);
    expect(isOvernight('23:59', '00:00')).toBe(true);
  });
  it('selesai sama dengan mulai dianggap lintas hari (konsisten dengan buildShiftWindow)', () => {
    expect(isOvernight('07:00', '07:00')).toBe(true);
  });
  it('jam tidak valid melempar error', () => {
    expect(() => isOvernight('7:00', '15:00')).toThrow();
  });
});
