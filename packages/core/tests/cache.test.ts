import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generateCacheKey,
  getFromCache,
  setInCache,
  clearCache,
  getCacheSize,
} from '../src/util/cache.js';
import { DEFAULT_CACHE_TTL_MS, MAX_CACHE_ENTRIES } from '../src/util/cache.js';
import type { RepoStats, StatsOptions } from '../src/model/types.js';

describe('Cache', () => {
  beforeEach(() => {
    clearCache();
  });

  describe('generateCacheKey', () => {
    it('should generate consistent keys for same inputs', () => {
      const options: StatsOptions = {
        sessionTimeoutMin: 45,
        timezone: 'UTC',
      };

      const key1 = generateCacheKey('owner', 'repo', options);
      const key2 = generateCacheKey('owner', 'repo', options);

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different repos', () => {
      const options: StatsOptions = {};

      const key1 = generateCacheKey('owner1', 'repo', options);
      const key2 = generateCacheKey('owner2', 'repo', options);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different options', () => {
      const options1: StatsOptions = { timezone: 'UTC' };
      const options2: StatsOptions = { timezone: 'America/New_York' };

      const key1 = generateCacheKey('owner', 'repo', options1);
      const key2 = generateCacheKey('owner', 'repo', options2);

      expect(key1).not.toBe(key2);
    });

    it('should include date ranges in key', () => {
      const options1: StatsOptions = { since: '2024-01-01' };
      const options2: StatsOptions = { since: '2024-02-01' };

      const key1 = generateCacheKey('owner', 'repo', options1);
      const key2 = generateCacheKey('owner', 'repo', options2);

      expect(key1).not.toBe(key2);
    });

    it('should include author filters in key', () => {
      const options1: StatsOptions = { authors: ['alice', 'bob'] };
      const options2: StatsOptions = { authors: ['alice', 'charlie'] };

      const key1 = generateCacheKey('owner', 'repo', options1);
      const key2 = generateCacheKey('owner', 'repo', options2);

      expect(key1).not.toBe(key2);
    });
  });

  describe('getFromCache and setInCache', () => {
    const mockStats: RepoStats = {
      repo: 'owner/repo',
      period: {},
      config: {
        sessionTimeoutMin: 45,
        firstCommitBonusMin: 15,
        timezone: 'UTC',
      },
      totals: {
        totalHours: 10,
        sessionsCount: 5,
        devDays: 3,
        totalCommits: 20,
        avgCommitsPerSession: 4,
        avgSessionsPerDay: 1.67,
        longestSessionHours: 3,
        avgSessionHours: 2,
        longestStreakDays: 2,
      },
      perAuthor: [],
      perDay: [],
    };

    it('should store and retrieve data from cache', () => {
      const key = 'test-key';
      const options: StatsOptions = { cache: 'memory' };

      setInCache(key, mockStats, options);
      const result = getFromCache(key, options);

      expect(result).toEqual(mockStats);
    });

    it('should return null for non-existent key', () => {
      const options: StatsOptions = { cache: 'memory' };
      const result = getFromCache('non-existent', options);

      expect(result).toBeNull();
    });

    it('should return null when cache is disabled', () => {
      const key = 'test-key';
      const options: StatsOptions = { cache: 'none' };

      setInCache(key, mockStats, options);
      const result = getFromCache(key, options);

      expect(result).toBeNull();
    });

    it('should not store data when cache is disabled', () => {
      const key = 'test-key';
      const noneOptions: StatsOptions = { cache: 'none' };
      const memoryOptions: StatsOptions = { cache: 'memory' };

      setInCache(key, mockStats, noneOptions);
      const result = getFromCache(key, memoryOptions);

      expect(result).toBeNull();
    });

    it('should expire cache entries after TTL', async () => {
      const key = 'test-key';
      const options: StatsOptions = { cache: 'memory', cacheTTLms: 50 };

      setInCache(key, mockStats, options);

      // Should be cached immediately
      let result = getFromCache(key, options);
      expect(result).toEqual(mockStats);

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should be expired
      result = getFromCache(key, options);
      expect(result).toBeNull();
    });

    it('should use default TTL of 1 hour when not specified', () => {
      const key = 'test-key';
      const options: StatsOptions = { cache: 'memory' };

      setInCache(key, mockStats, options);
      const result = getFromCache(key, options);

      expect(result).toEqual(mockStats);
    });
  });

  describe('clearCache', () => {
    it('should clear all cache entries', () => {
      const options: StatsOptions = { cache: 'memory' };
      const mockStats: RepoStats = {
        repo: 'owner/repo',
        period: {},
        config: { sessionTimeoutMin: 45, firstCommitBonusMin: 15, timezone: 'UTC' },
        totals: {
          totalHours: 10,
          sessionsCount: 5,
          devDays: 3,
          totalCommits: 20,
          avgCommitsPerSession: 4,
          avgSessionsPerDay: 1.67,
          longestSessionHours: 3,
          avgSessionHours: 2,
          longestStreakDays: 2,
        },
        perAuthor: [],
        perDay: [],
      };

      setInCache('key1', mockStats, options);
      setInCache('key2', mockStats, options);

      expect(getCacheSize()).toBe(2);

      clearCache();

      expect(getCacheSize()).toBe(0);
      expect(getFromCache('key1', options)).toBeNull();
      expect(getFromCache('key2', options)).toBeNull();
    });
  });

  describe('getCacheSize', () => {
    it('should return correct cache size', () => {
      const options: StatsOptions = { cache: 'memory' };
      const mockStats: RepoStats = {
        repo: 'owner/repo',
        period: {},
        config: { sessionTimeoutMin: 45, firstCommitBonusMin: 15, timezone: 'UTC' },
        totals: {
          totalHours: 10,
          sessionsCount: 5,
          devDays: 3,
          totalCommits: 20,
          avgCommitsPerSession: 4,
          avgSessionsPerDay: 1.67,
          longestSessionHours: 3,
          avgSessionHours: 2,
          longestStreakDays: 2,
        },
        perAuthor: [],
        perDay: [],
      };

      expect(getCacheSize()).toBe(0);

      setInCache('key1', mockStats, options);
      expect(getCacheSize()).toBe(1);

      setInCache('key2', mockStats, options);
      expect(getCacheSize()).toBe(2);

      setInCache('key1', mockStats, options); // Update existing
      expect(getCacheSize()).toBe(2);
    });
  });

  describe('key completeness and normalization', () => {
    const key = (options: StatsOptions) => generateCacheKey('owner', 'repo', options);

    it('includes every option that changes the result', () => {
      expect(key({ maxPages: 1 })).not.toBe(key({}));
      expect(key({ perPage: 50 })).not.toBe(key({}));
      expect(key({ githubToken: 'a' })).not.toBe(key({ githubToken: 'b' }));
      expect(key({ githubToken: 'a' })).not.toBe(key({}));
    });

    it('never contains the raw token', () => {
      expect(key({ githubToken: 'ghp_secret_value' })).not.toContain('ghp_secret_value');
    });

    it('normalizes equivalent inputs to the same key', () => {
      expect(key({ since: new Date('2024-01-01T00:00:00Z') })).toBe(
        key({ since: '2024-01-01T00:00:00Z' })
      );
      expect(key({ authors: ['Bob', 'alice'] })).toBe(key({ authors: ['alice', 'bob'] }));
      expect(key({ perPage: 500 })).toBe(key({ perPage: 100 }));
      expect(generateCacheKey('Owner', 'Repo', {})).toBe(key({}));
    });
  });

  describe('isolation, TTL and eviction', () => {
    const stats = (repo: string): RepoStats => ({
      repo,
      period: {},
      config: { sessionTimeoutMin: 45, firstCommitBonusMin: 15, timezone: 'UTC' },
      totals: {
        totalHours: 1,
        sessionsCount: 1,
        devDays: 1,
        totalCommits: 1,
        avgCommitsPerSession: 1,
        avgSessionsPerDay: 1,
        longestSessionHours: 1,
        avgSessionHours: 1,
        longestStreakDays: 1,
      },
      perAuthor: [],
      perDay: [
        { date: '2024-01-01', totalHours: 1, sessionsCount: 1, totalCommits: 1, authors: ['a'] },
      ],
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns copies, so callers cannot corrupt cached data', () => {
      const original = stats('o/r');
      setInCache('k', original, {});
      original.totals.totalHours = 999;

      const first = getFromCache('k', {})!;
      first.perDay[0].authors.push('mallory');

      const second = getFromCache('k', {})!;
      expect(second.totals.totalHours).toBe(1);
      expect(second.perDay[0].authors).toEqual(['a']);
      expect(second).not.toBe(first);
    });

    it('defaults to a 15 minute TTL', () => {
      vi.useFakeTimers();
      expect(DEFAULT_CACHE_TTL_MS).toBe(15 * 60 * 1000);
      setInCache('k', stats('o/r'), {});
      vi.advanceTimersByTime(DEFAULT_CACHE_TTL_MS - 1);
      expect(getFromCache('k', {})).not.toBeNull();
      vi.advanceTimersByTime(DEFAULT_CACHE_TTL_MS + 1);
      expect(getFromCache('k', {})).toBeNull();
    });

    it('drops expired entries when new ones are written', () => {
      vi.useFakeTimers();
      setInCache('old', stats('o/r'), {});
      vi.advanceTimersByTime(DEFAULT_CACHE_TTL_MS + 1);
      setInCache('new', stats('o/r'), {});
      expect(getCacheSize()).toBe(1);
    });

    it('evicts the least recently used entry beyond the size limit', () => {
      for (let i = 0; i < MAX_CACHE_ENTRIES; i++) {
        setInCache(`k${i}`, stats('o/r'), {});
      }
      getFromCache('k0', {}); // k0 is now most recently used
      setInCache('overflow', stats('o/r'), {});

      expect(getCacheSize()).toBe(MAX_CACHE_ENTRIES);
      expect(getFromCache('k0', {})).not.toBeNull();
      expect(getFromCache('k1', {})).toBeNull();
    });
  });
});
