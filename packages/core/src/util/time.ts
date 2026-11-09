import { formatInTimeZone } from 'date-fns-tz';

/**
 * Format a date as ISO date string (YYYY-MM-DD) in the specified timezone
 */
export function toISODate(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, 'yyyy-MM-dd');
}

/**
 * Get the day of week (0 = Sunday … 6 = Saturday) of an ISO date string (YYYY-MM-DD).
 * The date string is already expressed in the configured timezone, so this does not
 * depend on the timezone of the machine running the code.
 */
export function dayOfWeekOfISODate(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00Z`).getUTCDay();
}

/**
 * Check whether a string is a valid IANA timezone identifier
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalize a date input to a Date. Strings are parsed the way GitHub interprets
 * them (ISO 8601; date-only strings are treated as UTC midnight).
 */
export function toDate(input: string | Date): Date {
  return input instanceof Date ? input : new Date(input);
}

/**
 * Normalize a date input to an ISO 8601 string, keeping user strings as given.
 */
export function toDateString(input: string | Date): string {
  return input instanceof Date ? input.toISOString() : input;
}

/**
 * Get the difference in minutes between two dates
 */
export function diffInMinutes(date1: Date, date2: Date): number {
  return Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60);
}
