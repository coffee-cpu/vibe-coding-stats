import type { RepoInput, StatsOptions, RepoStats } from './model/types.js';
import { parseRepoInput, fetchGitHubCommits } from './api/github.js';
import { buildSessions } from './logic/sessions.js';
import { aggregateByAuthor, aggregateByDay, calculateAggregateStats } from './logic/aggregate.js';
import { resolveOptions } from './logic/options.js';
import { generateCacheKey, getFromCache, setInCache } from './util/cache.js';
import { transformGitHubCommit, unifyAuthorIdentities } from './logic/transform.js';
import { shouldIncludeCommit } from './logic/filters.js';
import { toDateString } from './util/time.js';

/**
 * Get coding statistics for a GitHub repository
 *
 * Analyzes commit history to estimate developer activity including hours spent,
 * coding sessions, and per-day/per-author breakdowns.
 *
 * @param repoInput - Repository identifier using either short format `{ repo: 'owner/repo' }` or URL format `{ url: 'https://github.com/owner/repo' }`
 * @param options - Configuration options for analysis (all optional)
 * @returns Promise resolving to detailed statistics about the repository
 *
 * @example
 * // Basic usage with short repo format
 * const stats = await getRepoStats({ repo: 'coffee-cpu/vibe-coding-stats' });
 *
 * @example
 * // Using full GitHub URL
 * const stats = await getRepoStats({ url: 'https://github.com/coffee-cpu/vibe-coding-stats' });
 *
 * @example
 * // With custom options
 * const stats = await getRepoStats(
 *   { repo: 'coffee-cpu/vibe-coding-stats' },
 *   {
 *     sessionTimeoutMin: 60,
 *     since: '2024-01-01',
 *     timezone: 'America/New_York',
 *     excludeBots: true
 *   }
 * );
 */
export async function getRepoStats(
  repoInput: RepoInput,
  options: StatsOptions = {}
): Promise<RepoStats> {
  // Parse and validate input before touching the cache or the network
  const { owner, repo } = parseRepoInput(repoInput);
  const config = resolveOptions(options);

  // Check cache
  const cacheKey = generateCacheKey(owner, repo, options);
  const cached = getFromCache(cacheKey, options);
  if (cached) {
    return cached;
  }

  // fetch → transform → unify identities → filter → sessions → aggregate
  const rawCommits = await fetchGitHubCommits(owner, repo, options);
  const commits = unifyAuthorIdentities(rawCommits.map(transformGitHubCommit)).filter((commit) =>
    shouldIncludeCommit(commit, options)
  );
  const sessions = buildSessions(commits, config);

  const result: RepoStats = {
    repo: `${owner}/${repo}`,
    period: {
      since: options.since ? toDateString(options.since) : undefined,
      until: options.until ? toDateString(options.until) : undefined,
    },
    config,
    totals: calculateAggregateStats(sessions),
    perAuthor: aggregateByAuthor(sessions),
    perDay: aggregateByDay(sessions),
  };

  setInCache(cacheKey, result, options);

  return result;
}

// Re-export types
export type {
  RepoInput,
  StatsOptions,
  RepoStats,
  AuthorStats,
  DayStats,
  Session,
  Commit,
  StatsErrorCode,
} from './model/types.js';
export { StatsError } from './model/types.js';

// Re-export cache utilities
export { clearCache, getCacheSize } from './util/cache.js';

// Re-export input parsing so apps can normalize user input the same way
export { parseRepoInput } from './api/github.js';
