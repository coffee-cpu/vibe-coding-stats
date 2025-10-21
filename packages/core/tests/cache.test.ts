import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateCacheKey,
  getFromCache,
  setInCache,
  clearCache,
  getCacheSize,
} from '../src/util/cache.js';
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
        coffeeCups: 5,
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
          coffeeCups: 5,
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
          coffeeCups: 5,
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
});
