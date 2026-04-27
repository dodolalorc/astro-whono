export const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

const toDateOnlyUtcText = (date: Date): string => {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const isUtcDateOnlyDate = (date: Date): boolean =>
  Number.isFinite(date.valueOf()) &&
  date.getUTCHours() === 0 &&
  date.getUTCMinutes() === 0 &&
  date.getUTCSeconds() === 0 &&
  date.getUTCMilliseconds() === 0;

export const parseDateOnlyUtc = (value: string): Date | null => {
  if (!DATE_ONLY_RE.test(value)) return null;

  const date = new Date(`${value}T00:00:00.000Z`);
  return toDateOnlyUtcText(date) === value ? date : null;
};

export const parseDateOnlyInput = (value: unknown): Date | null => {
  if (typeof value === 'string') return parseDateOnlyUtc(value);
  if (value instanceof Date && isUtcDateOnlyDate(value)) return new Date(value.valueOf());
  return null;
};
