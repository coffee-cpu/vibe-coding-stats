import { describe, it, expect } from 'vitest';
import {
  toISODate,
  toDate,
  toDateString,
  diffInMinutes,
  dayOfWeekOfISODate,
  isValidTimezone,
} from '../src/util/time.js';

describe('time utilities', () => {
  describe('toISODate', () => {
    it('should format date in UTC timezone', () => {
      const date = new Date('2024-01-15T14:30:00Z');
      expect(toISODate(date, 'UTC')).toBe('2024-01-15');
    });

    it('should format date in different timezone', () => {
      const date = new Date('2024-01-15T23:30:00Z');
      // In America/New_York, this is still Jan 15 (18:30 EST)
      expect(toISODate(date, 'America/New_York')).toBe('2024-01-15');
    });

    it('should handle date crossing midnight boundary', () => {
      const date = new Date('2024-01-16T01:30:00Z');
      // In America/Los_Angeles (PST), this is still Jan 15 (17:30)
      expect(toISODate(date, 'America/Los_Angeles')).toBe('2024-01-15');
    });

    it('should handle daylight saving time transitions', () => {
      // March 10, 2024 is when DST starts in US
      const date = new Date('2024-03-10T12:00:00Z');
      expect(toISODate(date, 'America/New_York')).toBe('2024-03-10');
    });
  });

  describe('toISODate around daylight saving transitions', () => {
    it('keeps the local date right before and after the US spring-forward gap', () => {
      // 2024-03-10 02:00 EST → 03:00 EDT
      expect(toISODate(new Date('2024-03-10T06:59:00Z'), 'America/New_York')).toBe('2024-03-10'); // 01:59 EST
      expect(toISODate(new Date('2024-03-10T07:00:00Z'), 'America/New_York')).toBe('2024-03-10'); // 03:00 EDT
    });

    it('uses the new offset after spring-forward when crossing midnight', () => {
      // 2024-03-11 03:59Z is 23:59 EDT on Mar 10 (it would be 22:59 under EST)
      expect(toISODate(new Date('2024-03-11T03:59:00Z'), 'America/New_York')).toBe('2024-03-10');
      expect(toISODate(new Date('2024-03-11T04:00:00Z'), 'America/New_York')).toBe('2024-03-11');
    });

    it('handles the repeated hour at fall-back', () => {
      // 2024-11-03 01:30 happens twice in New York (EDT, then EST)
      expect(toISODate(new Date('2024-11-03T05:30:00Z'), 'America/New_York')).toBe('2024-11-03');
      expect(toISODate(new Date('2024-11-03T06:30:00Z'), 'America/New_York')).toBe('2024-11-03');
      // 2024-11-04 04:30Z is 23:30 EST on Nov 3
      expect(toISODate(new Date('2024-11-04T04:30:00Z'), 'America/New_York')).toBe('2024-11-03');
    });

    it('handles southern hemisphere DST (Australia/Sydney, April fall-back)', () => {
      // 2024-04-07 03:00 AEDT → 02:00 AEST; 2024-04-06T13:30Z is 00:30 AEDT Apr 7
      expect(toISODate(new Date('2024-04-06T13:30:00Z'), 'Australia/Sydney')).toBe('2024-04-07');
    });
  });

  describe('toDate / toDateString', () => {
    it('returns Date objects as-is', () => {
      const date = new Date('2024-01-15T14:30:00Z');
      expect(toDate(date)).toBe(date);
    });

    it('parses ISO strings, treating date-only strings as UTC midnight like GitHub', () => {
      expect(toDate('2024-01-15T14:30:00Z').toISOString()).toBe('2024-01-15T14:30:00.000Z');
      expect(toDate('2024-01-15').toISOString()).toBe('2024-01-15T00:00:00.000Z');
    });

    it('formats Dates as ISO and keeps strings unchanged', () => {
      expect(toDateString(new Date('2024-01-15T00:00:00Z'))).toBe('2024-01-15T00:00:00.000Z');
      expect(toDateString('2024-01-15')).toBe('2024-01-15');
    });
  });

  describe('dayOfWeekOfISODate', () => {
    it('returns the weekday independent of the machine timezone', () => {
      expect(dayOfWeekOfISODate('2024-01-07')).toBe(0); // Sunday
      expect(dayOfWeekOfISODate('2024-01-08')).toBe(1); // Monday
      expect(dayOfWeekOfISODate('2024-01-13')).toBe(6); // Saturday
    });
  });

  describe('isValidTimezone', () => {
    it('accepts IANA zones and rejects unknown ones', () => {
      expect(isValidTimezone('UTC')).toBe(true);
      expect(isValidTimezone('America/New_York')).toBe(true);
      expect(isValidTimezone('Mars/Base')).toBe(false);
    });
  });

  describe('diffInMinutes', () => {
    it('should calculate difference in minutes', () => {
      const date1 = new Date('2024-01-15T14:00:00Z');
      const date2 = new Date('2024-01-15T14:30:00Z');
      expect(diffInMinutes(date1, date2)).toBe(30);
    });

    it('should return absolute difference', () => {
      const date1 = new Date('2024-01-15T14:30:00Z');
      const date2 = new Date('2024-01-15T14:00:00Z');
      expect(diffInMinutes(date1, date2)).toBe(30);
    });

    it('should handle same dates', () => {
      const date = new Date('2024-01-15T14:00:00Z');
      expect(diffInMinutes(date, date)).toBe(0);
    });

    it('should handle large time differences', () => {
      const date1 = new Date('2024-01-15T14:00:00Z');
      const date2 = new Date('2024-01-16T14:00:00Z');
      expect(diffInMinutes(date1, date2)).toBe(1440); // 24 hours
    });

    it('should handle fractional minutes', () => {
      const date1 = new Date('2024-01-15T14:00:00Z');
      const date2 = new Date('2024-01-15T14:00:30Z');
      expect(diffInMinutes(date1, date2)).toBe(0.5);
    });
  });
});
