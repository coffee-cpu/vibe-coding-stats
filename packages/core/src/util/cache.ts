import type { RepoStats, StatsOptions } from '../model/types.js';

interface CacheEntry {
  data: RepoStats;
  timestamp: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry>();

  get(key: string, ttlMs: number): RepoStats | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > ttlMs) {
      // Entry expired
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key: string, data: RepoStats): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Singleton instance
const memoryCache = new MemoryCache();

/**
 * Generate a cache key from repo and options
 */
export function generateCacheKey(
  owner: string,
  repo: string,
  options: StatsOptions
): string {
  const parts = [
    `${owner}/${repo}`,
    options.since?.toString() ?? '',
    options.until?.toString() ?? '',
    options.authors?.join(',') ?? '',
    options.excludeBots?.toString() ?? 'true',
    options.excludeMergeCommits?.toString() ?? 'false',
    options.sessionTimeoutMin?.toString() ?? '45',
    options.firstCommitBonusMin?.toString() ?? '15',
    options.timezone ?? 'UTC',
  ];

  return parts.join('|');
}

/**
 * Get data from cache if available and not expired
 */
export function getFromCache(
  key: string,
  options: StatsOptions
): RepoStats | null {
  if (options.cache === 'none') {
    return null;
  }

  // Default TTL: 1 hour (3600000 ms)
  const ttlMs = options.cacheTTLms ?? 3600000;
  return memoryCache.get(key, ttlMs);
}

/**
 * Store data in cache
 */
export function setInCache(
  key: string,
  data: RepoStats,
  options: StatsOptions
): void {
  if (options.cache === 'none') {
    return;
  }

  memoryCache.set(key, data);
}

/**
 * Clear all cache entries
 */
export function clearCache(): void {
  memoryCache.clear();
}

/**
 * Get cache size
 */
export function getCacheSize(): number {
  return memoryCache.size();
}
