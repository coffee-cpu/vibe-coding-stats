import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRepoStats, clearCache } from '../src/index.js';
import { StatsError } from '../src/model/types.js';
import type { GitHubCommit } from '../src/model/types.js';

describe('getRepoStats integration', () => {
  beforeEach(() => {
    clearCache();
  });

  function createMockGitHubCommit(
    sha: string,
    authorName: string,
    authorLogin: string,
    date: string,
    isMerge: boolean = false
  ): GitHubCommit {
    return {
      sha,
      commit: {
        author: {
          name: authorName,
          email: `${authorLogin}@example.com`,
          date,
        },
        message: 'Test commit',
      },
      author: { login: authorLogin, type: 'User' },
      parents: isMerge ? [{ sha: 'p1' }, { sha: 'p2' }] : [{ sha: 'p1' }],
    };
  }

  it('should return stats for a simple repository', async () => {
    const mockCommits = [
      createMockGitHubCommit('sha1', 'Alice', 'alice', '2024-01-15T14:00:00Z'),
      createMockGitHubCommit('sha2', 'Alice', 'alice', '2024-01-15T14:30:00Z'), // 30 min later (same session)
      createMockGitHubCommit('sha3', 'Alice', 'alice', '2024-01-15T15:00:00Z'), // 30 min later (same session)
      createMockGitHubCommit('sha4', 'Alice', 'alice', '2024-01-15T16:00:00Z'), // 60 min later (new session, >45 min)
      createMockGitHubCommit('sha5', 'Bob', 'bob', '2024-01-15T17:00:00Z'),
      createMockGitHubCommit('sha6', 'Bob', 'bob', '2024-01-15T19:00:00Z'), // 120 min later (new session, >45 min)
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCommits,
    });

    const stats = await getRepoStats(
      { repo: 'owner/repo' },
      { fetchImpl: mockFetch }
    );

    expect(stats.repo).toBe('owner/repo');
    expect(stats.totals.totalCommits).toBe(6);
    expect(stats.totals.sessionsCount).toBe(4); // Alice: 2 sessions, Bob: 2 sessions
    expect(stats.totals.devDays).toBe(1);

    // Per-author stats
    expect(stats.perAuthor).toHaveLength(2);
    const aliceStats = stats.perAuthor.find((a) => a.author === 'alice');
    const bobStats = stats.perAuthor.find((a) => a.author === 'bob');

    expect(aliceStats?.totalCommits).toBe(4);
    expect(aliceStats?.sessionsCount).toBe(2);
    expect(bobStats?.totalCommits).toBe(2);
    expect(bobStats?.sessionsCount).toBe(2);

    // Per-day stats
    expect(stats.perDay).toHaveLength(1);
    expect(stats.perDay[0].date).toBe('2024-01-15');
    expect(stats.perDay[0].totalCommits).toBe(6);
    expect(stats.perDay[0].authors).toHaveLength(2);
  });

  it('should handle empty repository', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const stats = await getRepoStats(
      { repo: 'owner/repo' },
      { fetchImpl: mockFetch }
    );

    expect(stats.totals).toEqual({
      totalHours: 0,
      sessionsCount: 0,
      devDays: 0,
      totalCommits: 0,
      avgCommitsPerSession: 0,
      avgSessionsPerDay: 0,
      longestSessionHours: 0,
    });
    expect(stats.perAuthor).toHaveLength(0);
    expect(stats.perDay).toHaveLength(0);
  });

  it('should respect custom session timeout', async () => {
    const mockCommits = [
      createMockGitHubCommit('sha1', 'Alice', 'alice', '2024-01-15T14:00:00Z'),
      createMockGitHubCommit('sha2', 'Alice', 'alice', '2024-01-15T14:35:00Z'), // 35 min gap
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCommits,
    });

    // With 30 min timeout, should be 2 sessions
    const stats1 = await getRepoStats(
      { repo: 'owner/repo' },
      { sessionTimeoutMin: 30, fetchImpl: mockFetch }
    );
    expect(stats1.totals.sessionsCount).toBe(2);

    // With 40 min timeout, should be 1 session
    const stats2 = await getRepoStats(
      { repo: 'owner/repo' },
      { sessionTimeoutMin: 40, fetchImpl: mockFetch }
    );
    expect(stats2.totals.sessionsCount).toBe(1);
  });

  it('should respect custom first commit bonus', async () => {
    const mockCommits = [
      createMockGitHubCommit('sha1', 'Alice', 'alice', '2024-01-15T14:00:00Z'),
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCommits,
    });

    const stats = await getRepoStats(
      { repo: 'owner/repo' },
      { firstCommitBonusMin: 30, fetchImpl: mockFetch }
    );

    // Single commit should get 30 min bonus
    expect(stats.totals.totalHours).toBe(0.5);
  });

  it('should filter by date range', async () => {
    const mockCommits = [
      createMockGitHubCommit('sha1', 'Alice', 'alice', '2024-01-15T14:00:00Z'),
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCommits,
    });

    const stats = await getRepoStats(
      { repo: 'owner/repo' },
      {
        since: '2024-01-01T00:00:00Z',
        until: '2024-12-31T23:59:59Z',
        fetchImpl: mockFetch,
      }
    );

    expect(stats.period.since).toBe('2024-01-01T00:00:00Z');
    expect(stats.period.until).toBe('2024-12-31T23:59:59Z');

    // Verify API was called with date params
    const callUrl = mockFetch.mock.calls[0][0] as string;
    expect(callUrl).toContain('since=');
    expect(callUrl).toContain('until=');
  });

  it('should handle Date objects for date range', async () => {
    const mockCommits = [
      createMockGitHubCommit('sha1', 'Alice', 'alice', '2024-01-15T14:00:00Z'),
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCommits,
    });

    const since = new Date('2024-01-01T00:00:00Z');
    const until = new Date('2024-12-31T23:59:59Z');

    const stats = await getRepoStats(
      { repo: 'owner/repo' },
      {
        since,
        until,
        fetchImpl: mockFetch,
      }
    );

    expect(stats.period.since).toBe(since.toISOString());
    expect(stats.period.until).toBe(until.toISOString());
  });

  it('should filter by authors', async () => {
    const mockCommits = [
      createMockGitHubCommit('sha1', 'Alice', 'alice', '2024-01-15T14:00:00Z'),
      createMockGitHubCommit('sha2', 'Bob', 'bob', '2024-01-15T15:00:00Z'),
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCommits,
    });

    const stats = await getRepoStats(
      { repo: 'owner/repo' },
      { authors: ['alice'], fetchImpl: mockFetch }
    );

    expect(stats.totals.totalCommits).toBe(1);
    expect(stats.perAuthor).toHaveLength(1);
    expect(stats.perAuthor[0].author).toBe('alice');
  });

  it('should exclude bots by default', async () => {
    const mockCommits = [
      createMockGitHubCommit('sha1', 'Alice', 'alice', '2024-01-15T14:00:00Z'),
      {
        sha: 'sha2',
        commit: {
          author: {
            name: 'dependabot',
            email: 'dependabot@example.com',
            date: '2024-01-15T15:00:00Z',
          },
          message: 'Update dependencies',
        },
        author: { login: 'dependabot[bot]', type: 'Bot' },
        parents: [{ sha: 'p1' }],
      },
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCommits,
    });

    const stats = await getRepoStats(
      { repo: 'owner/repo' },
      { fetchImpl: mockFetch }
    );

    expect(stats.totals.totalCommits).toBe(1);
    expect(stats.perAuthor).toHaveLength(1);
    expect(stats.perAuthor[0].author).toBe('alice');
  });

  it('should include bots when excludeBots is false', async () => {
    const mockCommits = [
      createMockGitHubCommit('sha1', 'Alice', 'alice', '2024-01-15T14:00:00Z'),
      {
        sha: 'sha2',
        commit: {
          author: {
            name: 'dependabot',
            email: 'dependabot@example.com',
            date: '2024-01-15T15:00:00Z',
          },
          message: 'Update dependencies',
        },
        author: { login: 'dependabot[bot]', type: 'Bot' },
        parents: [{ sha: 'p1' }],
      },
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCommits,
    });

    const stats = await getRepoStats(
      { repo: 'owner/repo' },
      { excludeBots: false, fetchImpl: mockFetch }
    );

    expect(stats.totals.totalCommits).toBe(2);
    expect(stats.perAuthor).toHaveLength(2);
  });

  it('should exclude merge commits when excludeMergeCommits is true', async () => {
    const mockCommits = [
      createMockGitHubCommit('sha1', 'Alice', 'alice', '2024-01-15T14:00:00Z', false),
      createMockGitHubCommit('sha2', 'Alice', 'alice', '2024-01-15T15:00:00Z', true),
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCommits,
    });

    const stats = await getRepoStats(
      { repo: 'owner/repo' },
      { excludeMergeCommits: true, fetchImpl: mockFetch }
    );

    expect(stats.totals.totalCommits).toBe(1);
  });

  it('should use different timezones', async () => {
    const mockCommits = [
      // This is 8PM EST on Jan 15 (01:00 UTC on Jan 16)
      createMockGitHubCommit('sha1', 'Alice', 'alice', '2024-01-16T01:00:00Z'),
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCommits,
    });

    const statsUTC = await getRepoStats(
      { repo: 'owner/repo' },
      { timezone: 'UTC', fetchImpl: mockFetch }
    );

    const statsEST = await getRepoStats(
      { repo: 'owner/repo' },
      { timezone: 'America/New_York', fetchImpl: mockFetch }
    );

    expect(statsUTC.perDay[0].date).toBe('2024-01-16');
    expect(statsEST.perDay[0].date).toBe('2024-01-15');
  });

  it('should include config in result', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const stats = await getRepoStats(
      { repo: 'owner/repo' },
      {
        sessionTimeoutMin: 60,
        firstCommitBonusMin: 20,
        timezone: 'America/Los_Angeles',
        fetchImpl: mockFetch,
      }
    );

    expect(stats.config).toEqual({
      sessionTimeoutMin: 60,
      firstCommitBonusMin: 20,
      timezone: 'America/Los_Angeles',
    });
  });

  it('should parse repo from URL input', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const stats = await getRepoStats(
      { url: 'https://github.com/owner/repo' },
      { fetchImpl: mockFetch }
    );

    expect(stats.repo).toBe('owner/repo');
  });

  it('should throw error for invalid repo', async () => {
    await expect(
      getRepoStats(
        { repo: 'invalid-format' },
        { fetchImpl: fetch }
      )
    ).rejects.toThrow(StatsError);
  });

  it('should calculate session durations correctly', async () => {
    const mockCommits = [
      // Session 1: Alice, 2 commits, 30 min span
      createMockGitHubCommit('sha1', 'Alice', 'alice', '2024-01-15T14:00:00Z'),
      createMockGitHubCommit('sha2', 'Alice', 'alice', '2024-01-15T14:30:00Z'),
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCommits,
    });

    const stats = await getRepoStats(
      { repo: 'owner/repo' },
      { firstCommitBonusMin: 15, fetchImpl: mockFetch }
    );

    // Duration: (14:30 - 14:00) + 15 bonus = 30 + 15 = 45 min = 0.75 hours
    expect(stats.totals.totalHours).toBe(0.75);
  });

  it('should handle multiple days correctly', async () => {
    const mockCommits = [
      createMockGitHubCommit('sha1', 'Alice', 'alice', '2024-01-15T14:00:00Z'),
      createMockGitHubCommit('sha2', 'Alice', 'alice', '2024-01-16T14:00:00Z'),
      createMockGitHubCommit('sha3', 'Bob', 'bob', '2024-01-17T14:00:00Z'),
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCommits,
    });

    const stats = await getRepoStats(
      { repo: 'owner/repo' },
      { fetchImpl: mockFetch }
    );

    expect(stats.totals.devDays).toBe(3);
    expect(stats.perDay).toHaveLength(3);
    expect(stats.perDay[0].date).toBe('2024-01-15');
    expect(stats.perDay[1].date).toBe('2024-01-16');
    expect(stats.perDay[2].date).toBe('2024-01-17');
  });

  it('should calculate averages correctly', async () => {
    const mockCommits = [
      // Day 1: Alice with 3 commits in 1 session
      createMockGitHubCommit('sha1', 'Alice', 'alice', '2024-01-15T14:00:00Z'),
      createMockGitHubCommit('sha2', 'Alice', 'alice', '2024-01-15T14:15:00Z'),
      createMockGitHubCommit('sha3', 'Alice', 'alice', '2024-01-15T14:30:00Z'),
      // Day 2: Bob with 2 commits in 1 session
      createMockGitHubCommit('sha4', 'Bob', 'bob', '2024-01-16T14:00:00Z'),
      createMockGitHubCommit('sha5', 'Bob', 'bob', '2024-01-16T14:10:00Z'),
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCommits,
    });

    const stats = await getRepoStats(
      { repo: 'owner/repo' },
      { fetchImpl: mockFetch }
    );

    expect(stats.totals.totalCommits).toBe(5);
    expect(stats.totals.sessionsCount).toBe(2);
    expect(stats.totals.devDays).toBe(2);
    expect(stats.totals.avgCommitsPerSession).toBe(2.5); // 5 / 2
    expect(stats.totals.avgSessionsPerDay).toBe(1); // 2 / 2
  });

  it('should cache results and reuse them on subsequent calls', async () => {
    const mockCommits = [
      createMockGitHubCommit('sha1', 'Alice', 'alice', '2024-01-15T14:00:00Z'),
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCommits,
    });

    clearCache();

    // First call - should fetch from API
    const stats1 = await getRepoStats(
      { repo: 'owner/repo' },
      { cache: 'memory', fetchImpl: mockFetch }
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(stats1.totals.totalCommits).toBe(1);

    // Second call with same params - should use cache
    const stats2 = await getRepoStats(
      { repo: 'owner/repo' },
      { cache: 'memory', fetchImpl: mockFetch }
    );

    expect(mockFetch).toHaveBeenCalledTimes(1); // Still 1, not called again
    expect(stats2.totals.totalCommits).toBe(1);
    expect(stats2).toEqual(stats1);
  });

  it('should not cache when cache is disabled', async () => {
    const mockCommits = [
      createMockGitHubCommit('sha1', 'Alice', 'alice', '2024-01-15T14:00:00Z'),
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCommits,
    });

    clearCache();

    // First call
    await getRepoStats(
      { repo: 'owner/repo' },
      { cache: 'none', fetchImpl: mockFetch }
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Second call - should fetch again
    await getRepoStats(
      { repo: 'owner/repo' },
      { cache: 'none', fetchImpl: mockFetch }
    );

    expect(mockFetch).toHaveBeenCalledTimes(2); // Called twice
  });

  it('should use different cache entries for different options', async () => {
    const mockCommits = [
      createMockGitHubCommit('sha1', 'Alice', 'alice', '2024-01-15T14:00:00Z'),
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCommits,
    });

    clearCache();

    // First call with timezone UTC
    await getRepoStats(
      { repo: 'owner/repo' },
      { timezone: 'UTC', cache: 'memory', fetchImpl: mockFetch }
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Second call with different timezone - should not use cache
    await getRepoStats(
      { repo: 'owner/repo' },
      { timezone: 'America/New_York', cache: 'memory', fetchImpl: mockFetch }
    );

    expect(mockFetch).toHaveBeenCalledTimes(2); // Called again
  });
});
