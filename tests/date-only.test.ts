import { describe, expect, it } from 'vitest';
import { parseDateOnlyInput, parseDateOnlyUtc } from '../src/utils/date-only';

describe('date-only utils', () => {
  it('accepts valid YYYY-MM-DD dates as UTC date-only values', () => {
    expect(parseDateOnlyUtc('2026-01-01')?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('rejects datetime values with timezone offsets', () => {
    expect(parseDateOnlyUtc('2026-01-01T23:30:00-08:00')).toBeNull();
    expect(parseDateOnlyInput(new Date('2026-01-01T23:30:00-08:00'))).toBeNull();
  });

  it('rejects impossible calendar dates', () => {
    expect(parseDateOnlyUtc('2026-02-31')).toBeNull();
  });
});
