import { format, parseISO } from 'date-fns';
import { utcToZonedTime, formatInTimeZone } from 'date-fns-tz';

/**
 * Convert a Date to a specific timezone
 */
export function toTimezone(date: Date, timezone: string): Date {
  return utcToZonedTime(date, timezone);
}

/**
 * Format a date as ISO date string (YYYY-MM-DD) in the specified timezone
 */
export function toISODate(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, 'yyyy-MM-dd');
}

/**
 * Parse various date inputs to Date object
 */
export function parseDate(input: string | Date): Date {
  if (input instanceof Date) {
    return input;
  }
  return parseISO(input);
}

/**
 * Get the difference in minutes between two dates
 */
export function diffInMinutes(date1: Date, date2: Date): number {
  return Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60);
}
