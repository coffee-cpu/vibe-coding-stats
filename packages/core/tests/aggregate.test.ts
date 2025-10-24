import { describe, it, expect } from 'vitest';
import { aggregateByAuthor, aggregateByDay, calculateTotals } from '../src/logic/aggregate.js';
import type { Session, Commit } from '../src/model/types.js';

describe('aggregation logic', () => {
  function createCommit(author: string, dateStr: string, sha: string): Commit {
    return {
      sha,
      author,
      date: new Date(dateStr),
      message: 'Test commit',
    };
  }

  function createSession(
    author: string,
    commits: Commit[],
    durationMin: number,
    date: string
  ): Session {
    return {
      author,
      commits,
      startTime: commits[0].date,
      endTime: commits[commits.length - 1].date,
      durationMinutes: durationMin,
      date,
    };
  }

  describe('aggregateByAuthor', () => {
    it('should aggregate single session per author', () => {
      const sessions: Session[] = [
        createSession(
          'alice',
          [createCommit('alice', '2024-01-15T14:00:00Z', 'sha1')],
          150, // 2.5 hours
          '2024-01-15'
        ),
      ];

      const result = aggregateByAuthor(sessions);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        author: 'alice',
        totalHours: 2.5,
        sessionsCount: 1,
        totalCommits: 1,
        longestSessionHours: 2.5,
      });
    });

    it('should aggregate multiple sessions for same author', () => {
      const sessions: Session[] = [
        createSession(
          'alice',
          [
            createCommit('alice', '2024-01-15T09:00:00Z', 'sha1'),
            createCommit('alice', '2024-01-15T09:30:00Z', 'sha2'),
          ],
          130, // 2.17 hours
          '2024-01-15'
        ),
        createSession(
          'alice',
          [createCommit('alice', '2024-01-15T14:00:00Z', 'sha3')],
          250, // 4.17 hours
          '2024-01-15'
        ),
      ];

      const result = aggregateByAuthor(sessions);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        author: 'alice',
        totalHours: 6.33, // 130 + 250 = 380 min = 6.33 hours
        sessionsCount: 2,
        totalCommits: 3,
        longestSessionHours: 4.17, // 250 min
      });
    });

    it('should aggregate multiple authors', () => {
      const sessions: Session[] = [
        createSession(
          'alice',
          [createCommit('alice', '2024-01-15T09:00:00Z', 'sha1')],
          60,
          '2024-01-15'
        ),
        createSession(
          'bob',
          [createCommit('bob', '2024-01-15T10:00:00Z', 'sha2')],
          30,
          '2024-01-15'
        ),
      ];

      const result = aggregateByAuthor(sessions);

      expect(result).toHaveLength(2);
      // Should be sorted by totalHours descending
      expect(result[0].author).toBe('alice');
      expect(result[0].totalHours).toBe(1);
      expect(result[1].author).toBe('bob');
      expect(result[1].totalHours).toBe(0.5);
    });

    it('should sort authors by total hours descending', () => {
      const sessions: Session[] = [
        createSession(
          'alice',
          [createCommit('alice', '2024-01-15T09:00:00Z', 'sha1')],
          30,
          '2024-01-15'
        ),
        createSession(
          'bob',
          [createCommit('bob', '2024-01-15T10:00:00Z', 'sha2')],
          120,
          '2024-01-15'
        ),
        createSession(
          'charlie',
          [createCommit('charlie', '2024-01-15T11:00:00Z', 'sha3')],
          60,
          '2024-01-15'
        ),
      ];

      const result = aggregateByAuthor(sessions);

      expect(result[0].author).toBe('bob'); // 120 min
      expect(result[1].author).toBe('charlie'); // 60 min
      expect(result[2].author).toBe('alice'); // 30 min
    });

    it('should handle empty sessions array', () => {
      const result = aggregateByAuthor([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('aggregateByDay', () => {
    it('should aggregate single session per day', () => {
      const sessions: Session[] = [
        createSession(
          'alice',
          [createCommit('alice', '2024-01-15T14:00:00Z', 'sha1')],
          60,
          '2024-01-15'
        ),
      ];

      const result = aggregateByDay(sessions);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        date: '2024-01-15',
        totalHours: 1,
        sessionsCount: 1,
        totalCommits: 1,
        authors: ['alice'],
      });
    });

    it('should aggregate multiple sessions on same day', () => {
      const sessions: Session[] = [
        createSession(
          'alice',
          [createCommit('alice', '2024-01-15T09:00:00Z', 'sha1')],
          60,
          '2024-01-15'
        ),
        createSession(
          'bob',
          [createCommit('bob', '2024-01-15T10:00:00Z', 'sha2')],
          45,
          '2024-01-15'
        ),
        createSession(
          'alice',
          [createCommit('alice', '2024-01-15T14:00:00Z', 'sha3')],
          30,
          '2024-01-15'
        ),
      ];

      const result = aggregateByDay(sessions);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        date: '2024-01-15',
        totalHours: 2.25, // 60 + 45 + 30 = 135 min = 2.25 hours
        sessionsCount: 3,
        totalCommits: 3,
        authors: ['alice', 'bob'], // Unique authors
      });
    });

    it('should not duplicate authors on same day', () => {
      const sessions: Session[] = [
        createSession(
          'alice',
          [createCommit('alice', '2024-01-15T09:00:00Z', 'sha1')],
          60,
          '2024-01-15'
        ),
        createSession(
          'alice',
          [createCommit('alice', '2024-01-15T14:00:00Z', 'sha2')],
          30,
          '2024-01-15'
        ),
      ];

      const result = aggregateByDay(sessions);

      expect(result[0].authors).toEqual(['alice']);
      expect(result[0].authors).toHaveLength(1);
    });

    it('should aggregate across multiple days', () => {
      const sessions: Session[] = [
        createSession(
          'alice',
          [createCommit('alice', '2024-01-15T09:00:00Z', 'sha1')],
          60,
          '2024-01-15'
        ),
        createSession(
          'alice',
          [createCommit('alice', '2024-01-16T09:00:00Z', 'sha2')],
          45,
          '2024-01-16'
        ),
      ];

      const result = aggregateByDay(sessions);

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2024-01-15');
      expect(result[1].date).toBe('2024-01-16');
    });

    it('should sort days chronologically', () => {
      const sessions: Session[] = [
        createSession(
          'alice',
          [createCommit('alice', '2024-01-17T09:00:00Z', 'sha1')],
          60,
          '2024-01-17'
        ),
        createSession(
          'alice',
          [createCommit('alice', '2024-01-15T09:00:00Z', 'sha2')],
          45,
          '2024-01-15'
        ),
        createSession(
          'alice',
          [createCommit('alice', '2024-01-16T09:00:00Z', 'sha3')],
          30,
          '2024-01-16'
        ),
      ];

      const result = aggregateByDay(sessions);

      expect(result[0].date).toBe('2024-01-15');
      expect(result[1].date).toBe('2024-01-16');
      expect(result[2].date).toBe('2024-01-17');
    });

    it('should handle empty sessions array', () => {
      const result = aggregateByDay([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('calculateTotals', () => {
    it('should calculate totals from single session', () => {
      const sessions: Session[] = [
        createSession(
          'alice',
          [createCommit('alice', '2024-01-15T14:00:00Z', 'sha1')],
          180, // 3 hours
          '2024-01-15'
        ),
      ];

      const result = calculateTotals(sessions);

      expect(result).toEqual({
        totalHours: 3,
        sessionsCount: 1,
        devDays: 1,
        totalCommits: 1,
        avgCommitsPerSession: 1,
        avgSessionsPerDay: 1,
        longestSessionHours: 3,
        avgSessionHours: 3,
        mostProductiveDayOfWeek: 'Monday',
        longestStreakDays: 1,
        minTimeBetweenSessionsMin: undefined, // Only 1 session
      });
    });

    it('should calculate totals from multiple sessions', () => {
      const sessions: Session[] = [
        createSession(
          'alice',
          [
            createCommit('alice', '2024-01-15T09:00:00Z', 'sha1'),
            createCommit('alice', '2024-01-15T09:30:00Z', 'sha2'),
            createCommit('alice', '2024-01-15T10:00:00Z', 'sha3'),
          ],
          150, // 2.5 hours
          '2024-01-15'
        ),
        createSession(
          'bob',
          [createCommit('bob', '2024-01-15T14:00:00Z', 'sha4')],
          250, // 4.17 hours
          '2024-01-15'
        ),
        createSession(
          'alice',
          [
            createCommit('alice', '2024-01-16T09:00:00Z', 'sha5'),
            createCommit('alice', '2024-01-16T09:15:00Z', 'sha6'),
          ],
          135, // 2.25 hours
          '2024-01-16'
        ),
      ];

      const result = calculateTotals(sessions);

      expect(result).toEqual({
        totalHours: 8.92, // 150 + 250 + 135 = 535 min = 8.92 hours
        sessionsCount: 3,
        devDays: 2, // Jan 15 and Jan 16
        totalCommits: 6,
        avgCommitsPerSession: 2, // 6 commits / 3 sessions
        avgSessionsPerDay: 1.5, // 3 sessions / 2 days
        longestSessionHours: 4.17, // 250 min
        avgSessionHours: 2.97, // 8.92 hours / 3 sessions
        mostProductiveDayOfWeek: 'Monday', // Jan 15 is Monday
        longestStreakDays: 2, // Jan 15 and Jan 16 are consecutive
        minTimeBetweenSessionsMin: 1380, // Alice session 1 ends at 10:00 (last commit), session 2 starts at 09:00 next day = 23 hours = 1380 minutes. Bob only has 1 session so not considered.
      });
    });

    it('should round numeric values to 2 decimal places', () => {
      const sessions: Session[] = [
        createSession(
          'alice',
          [
            createCommit('alice', '2024-01-15T09:00:00Z', 'sha1'),
            createCommit('alice', '2024-01-15T09:30:00Z', 'sha2'),
          ],
          33,
          '2024-01-15'
        ),
        createSession(
          'bob',
          [createCommit('bob', '2024-01-15T14:00:00Z', 'sha3')],
          33,
          '2024-01-15'
        ),
        createSession(
          'charlie',
          [createCommit('charlie', '2024-01-16T09:00:00Z', 'sha4')],
          33,
          '2024-01-16'
        ),
      ];

      const result = calculateTotals(sessions);

      // 99 min = 1.65 hours
      expect(result.totalHours).toBe(1.65);
      // 4 commits / 3 sessions = 1.333...
      expect(result.avgCommitsPerSession).toBe(1.33);
      // 3 sessions / 2 days = 1.5
      expect(result.avgSessionsPerDay).toBe(1.5);
    });

    it('should handle empty sessions array', () => {
      const result = calculateTotals([]);

      expect(result).toEqual({
        totalHours: 0,
        sessionsCount: 0,
        devDays: 0,
        totalCommits: 0,
        avgCommitsPerSession: 0,
        avgSessionsPerDay: 0,
        longestSessionHours: 0,
        avgSessionHours: 0,
        mostProductiveDayOfWeek: undefined,
        longestStreakDays: 0,
        minTimeBetweenSessionsMin: undefined,
      });
    });

    it('should count unique dev days correctly', () => {
      const sessions: Session[] = [
        createSession(
          'alice',
          [createCommit('alice', '2024-01-15T09:00:00Z', 'sha1')],
          60,
          '2024-01-15'
        ),
        createSession(
          'alice',
          [createCommit('alice', '2024-01-15T14:00:00Z', 'sha2')],
          30,
          '2024-01-15'
        ),
        createSession(
          'bob',
          [createCommit('bob', '2024-01-15T16:00:00Z', 'sha3')],
          45,
          '2024-01-15'
        ),
      ];

      const result = calculateTotals(sessions);

      expect(result.devDays).toBe(1); // All on same day
    });

    it('should calculate minTimeBetweenSessionsMin correctly for same author', () => {
      // Alice session 1: start=09:00, end=10:00, duration=120min → endTime = 09:00 + 120min = 11:00
      // Alice session 2: start=14:00, end=14:00, duration=90min → endTime = 14:00 + 90min = 15:30
      // Alice session 3: start=16:00, end=16:00, duration=60min → endTime = 16:00 + 60min = 17:00
      // Wait, the createSession helper uses the first and last commit dates as start/end
      // Let me create sessions with explicit start times
      const sessions: Session[] = [
        createSession(
          'alice',
          [
            createCommit('alice', '2024-01-15T09:00:00Z', 'sha1'),
            createCommit('alice', '2024-01-15T09:30:00Z', 'sha2'),
          ],
          60, // Session ends at 09:30 + bonus time
          '2024-01-15'
        ),
        createSession(
          'alice',
          [createCommit('alice', '2024-01-15T11:00:00Z', 'sha3')],
          45,
          '2024-01-15'
        ),
        createSession(
          'alice',
          [createCommit('alice', '2024-01-15T13:00:00Z', 'sha4')],
          30,
          '2024-01-15'
        ),
      ];

      const result = calculateTotals(sessions);

      // Session 1: 09:00 - 09:30, Session 2: 11:00 - 11:00, Session 3: 13:00 - 13:00
      // Gap 1: 09:30 to 11:00 = 90 min
      // Gap 2: 11:00 to 13:00 = 120 min
      expect(result.minTimeBetweenSessionsMin).toBe(90);
    });

    it('should return undefined for minTimeBetweenSessionsMin with less than 2 sessions', () => {
      const sessions: Session[] = [
        createSession(
          'alice',
          [createCommit('alice', '2024-01-15T09:00:00Z', 'sha1')],
          60,
          '2024-01-15'
        ),
      ];

      const result = calculateTotals(sessions);

      expect(result.minTimeBetweenSessionsMin).toBeUndefined();
    });

    it('should return undefined when no author has multiple sessions', () => {
      // Alice, Bob, and Charlie each have only 1 session
      const sessions: Session[] = [
        createSession(
          'alice',
          [
            createCommit('alice', '2024-01-15T09:00:00Z', 'sha1'),
            createCommit('alice', '2024-01-15T10:00:00Z', 'sha2'),
          ],
          120,
          '2024-01-15'
        ),
        createSession(
          'bob',
          [createCommit('bob', '2024-01-15T10:30:00Z', 'sha3')],
          90,
          '2024-01-15'
        ),
        createSession(
          'charlie',
          [createCommit('charlie', '2024-01-15T14:00:00Z', 'sha4')],
          60,
          '2024-01-15'
        ),
      ];

      const result = calculateTotals(sessions);

      expect(result.minTimeBetweenSessionsMin).toBeUndefined(); // No author has 2+ sessions
    });

    it('should find minimum gap across multiple authors', () => {
      // Alice session 1: 09:00-09:00 (single commit)
      // Alice session 2: 14:00-14:00 (single commit)
      // Bob session 1: 10:00-10:00 (single commit)
      // Bob session 2: 10:45-10:45 (single commit)
      // Alice gap: 09:00 to 14:00 = 300 min
      // Bob gap: 10:00 to 10:45 = 45 min
      // Min should be 45 min from Bob
      const sessions: Session[] = [
        createSession(
          'alice',
          [createCommit('alice', '2024-01-15T09:00:00Z', 'sha1')],
          120,
          '2024-01-15'
        ),
        createSession(
          'alice',
          [createCommit('alice', '2024-01-15T14:00:00Z', 'sha2')],
          60,
          '2024-01-15'
        ),
        createSession(
          'bob',
          [createCommit('bob', '2024-01-15T10:00:00Z', 'sha3')],
          30,
          '2024-01-15'
        ),
        createSession(
          'bob',
          [createCommit('bob', '2024-01-15T10:45:00Z', 'sha4')],
          45,
          '2024-01-15'
        ),
      ];

      const result = calculateTotals(sessions);

      // Bob session 1 ends at 10:00, session 2 starts at 10:45 = 45 min gap
      expect(result.minTimeBetweenSessionsMin).toBe(45);
    });
  });
});
