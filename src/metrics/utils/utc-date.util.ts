const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoTimestamp(value: string): boolean {
  return ISO_TIMESTAMP_PATTERN.test(value);
}

export function isDateOnly(value: string): boolean {
  return DATE_ONLY_PATTERN.test(value);
}

export function parseIsoTimestamp(value: string): Date | null {
  if (!isIsoTimestamp(value)) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseDateOnlyToUtcDay(value: string): Date | null {
  if (!isDateOnly(value)) {
    return null;
  }

  const [year, month, day] = value.split('-').map((part) => Number(part));
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
}

export function startOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

export function addUtcDays(value: Date, days: number): Date {
  const result = startOfUtcDay(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function toUtcDateString(value: Date): string {
  return startOfUtcDay(value).toISOString().slice(0, 10);
}
