import { describe, it, expect } from 'vitest';
import { buildSessions } from '../src/logic/sessions.js';
import type { Commit } from '../src/model/types.js';

describe('session grouping', () => {
  const defaultConfig = {
    sessionTimeoutMin: 45,
    firstCommitBonusMin: 15,
    timezone: 'UTC',
  };

  function createCommit(author: string, dateStr: string, sha: string = 'abc123'): Commit {
    return {
      sha,
      author,
      date: new Date(dateStr),
      message: 'Test commit',
    };
  }

  describe('single commit sessions', () => {
    it('should create session with firstCommitBonusMin duration', () => {
      const commits = [createCommit('alice', '2024-01-15T14:00:00Z', 'sha1')];

      const sessions = buildSessions(commits, defaultConfig);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].author).toBe('alice');
      expect(sessions[0].commits).toHaveLength(1);
      expect(sessions[0].durationMinutes).toBe(15);
      expect(sessions[0].date).toBe('2024-01-15');
    });

    it('should create separate sessions for different authors', () => {
      const commits = [
        createCommit('alice', '2024-01-15T14:00:00Z', 'sha1'),
        createCommit('bob', '2024-01-15T14:05:00Z', 'sha2'),
      ];

      const sessions = buildSessions(commits, defaultConfig);

      expect(sessions).toHaveLength(2);
      expect(sessions.find((s) => s.author === 'alice')).toBeDefined();
      expect(sessions.find((s) => s.author === 'bob')).toBeDefined();
    });
  });

  describe('multi-commit sessions', () => {
    it('should group commits within timeout threshold', () => {
      const commits = [
        createCommit('alice', '2024-01-15T14:00:00Z', 'sha1'),
        createCommit('alice', '2024-01-15T14:30:00Z', 'sha2'), // 30 min gap
        createCommit('alice', '2024-01-15T14:45:00Z', 'sha3'), // 15 min gap
      ];

      const sessions = buildSessions(commits, defaultConfig);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].commits).toHaveLength(3);
      // Duration: (14:45 - 14:00) + 15min bonus = 45 + 15 = 60 minutes
      expect(sessions[0].durationMinutes).toBe(60);
    });

    it('should split sessions when gap exceeds timeout', () => {
      const commits = [
        createCommit('alice', '2024-01-15T14:00:00Z', 'sha1'),
        createCommit('alice', '2024-01-15T14:30:00Z', 'sha2'), // 30 min gap (ok)
        createCommit('alice', '2024-01-15T15:30:00Z', 'sha3'), // 60 min gap (exceeds 45)
      ];

      const sessions = buildSessions(commits, defaultConfig);

      expect(sessions).toHaveLength(2);
      expect(sessions[0].commits).toHaveLength(2);
      expect(sessions[1].commits).toHaveLength(1);
      // First session: (14:30 - 14:00) + 15 = 45
      expect(sessions[0].durationMinutes).toBe(45);
      // Second session: single commit = 15
      expect(sessions[1].durationMinutes).toBe(15);
    });
  });

  describe('boundary conditions', () => {
    it('should keep session when gap is exactly at timeout (45 min)', () => {
      const commits = [
        createCommit('alice', '2024-01-15T14:00:00Z', 'sha1'),
        createCommit('alice', '2024-01-15T14:45:00Z', 'sha2'), // exactly 45 min
      ];

      const sessions = buildSessions(commits, defaultConfig);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].commits).toHaveLength(2);
    });

    it('should split session when gap is 1 minute over timeout (46 min)', () => {
      const commits = [
        createCommit('alice', '2024-01-15T14:00:00Z', 'sha1'),
        createCommit('alice', '2024-01-15T14:46:00Z', 'sha2'), // 46 min
      ];

      const sessions = buildSessions(commits, defaultConfig);

      expect(sessions).toHaveLength(2);
    });

    it('should keep session when gap is 1 minute under timeout (44 min)', () => {
      const commits = [
        createCommit('alice', '2024-01-15T14:00:00Z', 'sha1'),
        createCommit('alice', '2024-01-15T14:44:00Z', 'sha2'), // 44 min
      ];

      const sessions = buildSessions(commits, defaultConfig);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].commits).toHaveLength(2);
    });
  });

  describe('multiple sessions per author per day', () => {
    it('should create multiple sessions for same author on same day', () => {
      const commits = [
        createCommit('alice', '2024-01-15T09:00:00Z', 'sha1'),
        createCommit('alice', '2024-01-15T09:15:00Z', 'sha2'),
        // Long gap (2 hours)
        createCommit('alice', '2024-01-15T14:00:00Z', 'sha3'),
        createCommit('alice', '2024-01-15T14:30:00Z', 'sha4'),
      ];

      const sessions = buildSessions(commits, defaultConfig);

      expect(sessions).toHaveLength(2);
      expect(sessions[0].date).toBe('2024-01-15');
      expect(sessions[1].date).toBe('2024-01-15');
    });
  });

  describe('cross-midnight sessions', () => {
    it('should keep session spanning midnight as single session', () => {
      const commits = [
        createCommit('alice', '2024-01-15T23:30:00Z', 'sha1'),
        createCommit('alice', '2024-01-16T00:10:00Z', 'sha2'), // 40 min later
      ];

      const sessions = buildSessions(commits, defaultConfig);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].commits).toHaveLength(2);
      // Session date should be day it started (Jan 15)
      expect(sessions[0].date).toBe('2024-01-15');
    });

    it('should assign cross-midnight session to start day in configured timezone', () => {
      const commits = [
        // 11:30 PM EST (04:30 UTC next day)
        createCommit('alice', '2024-01-16T04:30:00Z', 'sha1'),
        // 12:00 AM EST next day (05:00 UTC) - 30 min gap
        createCommit('alice', '2024-01-16T05:00:00Z', 'sha2'),
      ];

      const sessions = buildSessions(commits, {
        ...defaultConfig,
        timezone: 'America/New_York',
      });

      expect(sessions).toHaveLength(1);
      // Should be Jan 15 in EST (even though UTC is Jan 16)
      expect(sessions[0].date).toBe('2024-01-15');
    });
  });

  describe('interleaved commits from different authors', () => {
    it('should correctly separate interleaved author commits', () => {
      const commits = [
        createCommit('alice', '2024-01-15T14:00:00Z', 'sha1'),
        createCommit('bob', '2024-01-15T14:05:00Z', 'sha2'),
        createCommit('alice', '2024-01-15T14:10:00Z', 'sha3'), // 10 min from alice's last
        createCommit('bob', '2024-01-15T14:15:00Z', 'sha4'), // 10 min from bob's last
      ];

      const sessions = buildSessions(commits, defaultConfig);

      expect(sessions).toHaveLength(2);
      const aliceSession = sessions.find((s) => s.author === 'alice');
      const bobSession = sessions.find((s) => s.author === 'bob');

      expect(aliceSession?.commits).toHaveLength(2);
      expect(bobSession?.commits).toHaveLength(2);
    });
  });

  describe('custom configuration', () => {
    it('should respect custom sessionTimeoutMin', () => {
      const commits = [
        createCommit('alice', '2024-01-15T14:00:00Z', 'sha1'),
        createCommit('alice', '2024-01-15T14:35:00Z', 'sha2'), // 35 min gap
      ];

      // With 30 min timeout, should split
      const sessions1 = buildSessions(commits, {
        sessionTimeoutMin: 30,
        firstCommitBonusMin: 15,
        timezone: 'UTC',
      });
      expect(sessions1).toHaveLength(2);

      // With 40 min timeout, should keep together
      const sessions2 = buildSessions(commits, {
        sessionTimeoutMin: 40,
        firstCommitBonusMin: 15,
        timezone: 'UTC',
      });
      expect(sessions2).toHaveLength(1);
    });

    it('should respect custom firstCommitBonusMin', () => {
      const commits = [createCommit('alice', '2024-01-15T14:00:00Z', 'sha1')];

      const sessions = buildSessions(commits, {
        sessionTimeoutMin: 45,
        firstCommitBonusMin: 30,
        timezone: 'UTC',
      });

      expect(sessions[0].durationMinutes).toBe(30);
    });
  });

  describe('edge cases', () => {
    it('should handle empty commit array', () => {
      const sessions = buildSessions([], defaultConfig);
      expect(sessions).toHaveLength(0);
    });

    it('should handle commits in random order', () => {
      const commits = [
        createCommit('alice', '2024-01-15T14:30:00Z', 'sha2'), // Out of order
        createCommit('alice', '2024-01-15T14:00:00Z', 'sha1'),
        createCommit('alice', '2024-01-15T14:15:00Z', 'sha3'),
      ];

      const sessions = buildSessions(commits, defaultConfig);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].commits).toHaveLength(3);
      // Should be sorted in session
      expect(sessions[0].commits[0].sha).toBe('sha1');
      expect(sessions[0].commits[1].sha).toBe('sha3');
      expect(sessions[0].commits[2].sha).toBe('sha2');
    });
  });

  describe('commit gap metrics', () => {
    it('should not calculate gaps for single-commit sessions', () => {
      const commits = [createCommit('alice', '2024-01-15T14:00:00Z', 'sha1')];

      const sessions = buildSessions(commits, defaultConfig);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].avgMinutesBetweenCommits).toBeUndefined();
      expect(sessions[0].maxMinutesBetweenCommits).toBeUndefined();
    });

    it('should calculate average and max gaps for multi-commit sessions', () => {
      const commits = [
        createCommit('alice', '2024-01-15T14:00:00Z', 'sha1'),
        createCommit('alice', '2024-01-15T14:10:00Z', 'sha2'), // 10 min gap
        createCommit('alice', '2024-01-15T14:30:00Z', 'sha3'), // 20 min gap
        createCommit('alice', '2024-01-15T14:45:00Z', 'sha4'), // 15 min gap
      ];

      const sessions = buildSessions(commits, defaultConfig);

      expect(sessions).toHaveLength(1);
      // Average: (10 + 20 + 15) / 3 = 15
      expect(sessions[0].avgMinutesBetweenCommits).toBe(15);
      // Max: 20
      expect(sessions[0].maxMinutesBetweenCommits).toBe(20);
    });

    it('should calculate gaps correctly for two-commit session', () => {
      const commits = [
        createCommit('alice', '2024-01-15T14:00:00Z', 'sha1'),
        createCommit('alice', '2024-01-15T14:25:00Z', 'sha2'), // 25 min gap
      ];

      const sessions = buildSessions(commits, defaultConfig);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].avgMinutesBetweenCommits).toBe(25);
      expect(sessions[0].maxMinutesBetweenCommits).toBe(25);
    });

    it('should handle uneven gaps', () => {
      const commits = [
        createCommit('alice', '2024-01-15T14:00:00Z', 'sha1'),
        createCommit('alice', '2024-01-15T14:05:00Z', 'sha2'), // 5 min gap
        createCommit('alice', '2024-01-15T14:45:00Z', 'sha3'), // 40 min gap (close to timeout)
      ];

      const sessions = buildSessions(commits, defaultConfig);

      expect(sessions).toHaveLength(1);
      // Average: (5 + 40) / 2 = 22.5
      expect(sessions[0].avgMinutesBetweenCommits).toBe(22.5);
      // Max: 40
      expect(sessions[0].maxMinutesBetweenCommits).toBe(40);
    });
  });
});
