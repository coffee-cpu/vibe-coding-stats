import { describe, it, expect } from 'vitest';
import { toTimezone, toISODate, parseDate, diffInMinutes } from '../src/util/time.js';

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

  describe('parseDate', () => {
    it('should return Date object as-is', () => {
      const date = new Date('2024-01-15T14:30:00Z');
      expect(parseDate(date)).toBe(date);
    });

    it('should parse ISO string', () => {
      const result = parseDate('2024-01-15T14:30:00Z');
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe('2024-01-15T14:30:00.000Z');
    });

    it('should parse ISO date string', () => {
      const result = parseDate('2024-01-15');
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(0); // January
      expect(result.getDate()).toBe(15);
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

  describe('toTimezone', () => {
    it('should convert date to timezone', () => {
      const date = new Date('2024-01-15T14:30:00Z');
      const converted = toTimezone(date, 'America/New_York');
      expect(converted).toBeInstanceOf(Date);
    });
  });
});
