export const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const ISO_DATETIME_WITH_ZONE_RE =
  /^(\d{4}-\d{2}-\d{2})[Tt](?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

export type EssayDateParseResult = {
  date: Date;
  dateText: string;
  publishedAt?: Date;
  publishedAtText?: string;
};

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

export const parseISO8601 = (value: string): Date | null => {
  if (!ISO8601_RE.test(value)) return null;

  const date = new Date(value);
  return Number.isFinite(date.valueOf()) ? date : null;
};

export const parseDateOnlyInput = (value: unknown): Date | null => {
  if (typeof value === 'string') return parseDateOnlyUtc(value);
  if (value instanceof Date && isUtcDateOnlyDate(value)) return new Date(value.valueOf());
  return null;
};

export const parseEssayPublishedAtInput = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return Number.isFinite(value.valueOf()) ? new Date(value.valueOf()) : null;
  }

  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const match = ISO_DATETIME_WITH_ZONE_RE.exec(trimmed);
  if (!match) return null;

  const dateText = match[1] ?? '';
  if (!parseDateOnlyUtc(dateText)) return null;

  const date = new Date(trimmed);
  return Number.isFinite(date.valueOf()) ? date : null;
};

export const parseEssayDateInput = (value: unknown): EssayDateParseResult | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const dateOnly = parseDateOnlyUtc(trimmed);
    if (dateOnly) {
      return {
        date: dateOnly,
        dateText: trimmed
      };
    }

    const match = ISO_DATETIME_WITH_ZONE_RE.exec(trimmed);
    if (!match) return null;

    const dateText = match[1] ?? '';
    const date = parseDateOnlyUtc(dateText);
    const publishedAt = parseEssayPublishedAtInput(trimmed);
    if (!date || !publishedAt) return null;

    return {
      date,
      dateText,
      publishedAt,
      publishedAtText: trimmed
    };
  }

  if (value instanceof Date) {
    if (!Number.isFinite(value.valueOf())) return null;

    if (isUtcDateOnlyDate(value)) {
      const dateText = toDateOnlyUtcText(value);
      return {
        date: new Date(value.valueOf()),
        dateText
      };
    }

    const dateText = toDateOnlyUtcText(value);
    const date = parseDateOnlyUtc(dateText);
    if (!date) return null;

    return {
      date,
      dateText,
      publishedAt: new Date(value.valueOf()),
      publishedAtText: value.toISOString()
    };
  }

  return null;
};
