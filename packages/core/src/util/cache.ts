import type { RepoStats, StatsOptions } from '../model/types.js';

interface CacheEntry {
  data: RepoStats;
  timestamp: number;
}

/** Default cache TTL: 15 minutes */
export const DEFAULT_CACHE_TTL_MS = 15 * 60 * 1000;

/** Maximum number of cached results; the least recently used entry is evicted beyond this */
export const MAX_CACHE_ENTRIES = 100;

/**
 * Deep-copy a result so callers can never mutate what is stored in the cache.
 * RepoStats is plain JSON-compatible data (strings, numbers, arrays, objects).
 */
function cloneStats(data: RepoStats): RepoStats {
  return JSON.parse(JSON.stringify(data)) as RepoStats;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry>();

  get(key: string, ttlMs: number): RepoStats | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > ttlMs) {
      this.cache.delete(key);
      return null;
    }

    // Refresh recency (Map keeps insertion order)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return cloneStats(entry.data);
  }

  set(key: string, data: RepoStats, ttlMs: number): void {
    this.cache.delete(key);
    this.cache.set(key, { data: cloneStats(data), timestamp: Date.now() });
    this.prune(ttlMs);
  }

  /** Drop expired entries and evict the least recently used ones beyond the size limit */
  private prune(ttlMs: number): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > ttlMs) this.cache.delete(key);
    }
    while (this.cache.size > MAX_CACHE_ENTRIES) {
      const oldestKey = this.cache.keys().next().value as string;
      this.cache.delete(oldestKey);
    }
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

function normalizeDateForKey(value: string | Date | undefined): string {
  if (value === undefined) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

/**
 * Short, non-reversible fingerprint of the token so results fetched with
 * different credentials (which may see different data) are cached separately
 * without keeping the token itself in the key.
 */
function fingerprint(value: string | undefined): string {
  if (!value) return '';
  // FNV-1a 32-bit
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Generate a cache key from repo and every option that affects the result
 */
export function generateCacheKey(owner: string, repo: string, options: StatsOptions): string {
  const authors = (options.authors ?? []).map((a) => a.toLowerCase()).sort();

  const parts = [
    `${owner}/${repo}`.toLowerCase(),
    normalizeDateForKey(options.since),
    normalizeDateForKey(options.until),
    authors.join(','),
    String(options.excludeBots ?? true),
    String(options.excludeMergeCommits ?? false),
    String(options.sessionTimeoutMin ?? 45),
    String(options.firstCommitBonusMin ?? 15),
    options.timezone ?? 'UTC',
    String(Math.min(options.perPage ?? 100, 100)),
    String(options.maxPages ?? ''),
    fingerprint(options.githubToken),
  ];

  return JSON.stringify(parts);
}

/**
 * Get a copy of cached data if available and not expired
 */
export function getFromCache(key: string, options: StatsOptions): RepoStats | null {
  if (options.cache === 'none') {
    return null;
  }
  return memoryCache.get(key, options.cacheTTLms ?? DEFAULT_CACHE_TTL_MS);
}

/**
 * Store a copy of data in cache
 */
export function setInCache(key: string, data: RepoStats, options: StatsOptions): void {
  if (options.cache === 'none') {
    return;
  }
  memoryCache.set(key, data, options.cacheTTLms ?? DEFAULT_CACHE_TTL_MS);
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
