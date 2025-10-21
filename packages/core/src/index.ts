import type { RepoInput, StatsOptions, RepoStats, Commit } from './model/types.js';
import { parseRepoInput, fetchGitHubCommits } from './api/github.js';
import { buildSessions } from './logic/sessions.js';
import { aggregateByAuthor, aggregateByDay, calculateTotals } from './logic/aggregate.js';
import { generateCacheKey, getFromCache, setInCache } from './util/cache.js';
import { transformGitHubCommit } from './logic/transform.js';
import { shouldIncludeCommit } from './logic/filters.js';

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

  // Parse repository
  const { owner, repo } = parseRepoInput(repoInput);
  const repoString = `${owner}/${repo}`;

  // Check cache
  const cacheKey = generateCacheKey(owner, repo, options);
  const cached = getFromCache(cacheKey, options);
  if (cached) {
    return cached;
  }

  // Set defaults
  const sessionTimeoutMin = options.sessionTimeoutMin ?? 45;
  const firstCommitBonusMin = options.firstCommitBonusMin ?? 15;
  const timezone = options.timezone ?? 'UTC';

  // Fetch raw commits from GitHub
  const rawCommits = await fetchGitHubCommits(owner, repo, options);

  // Transform and filter commits
  const commits: Commit[] = rawCommits
    .filter((ghCommit) => shouldIncludeCommit(ghCommit, options))
    .map((ghCommit) => transformGitHubCommit(ghCommit));

  // Build sessions
  const sessions = buildSessions(commits, {
    sessionTimeoutMin,
    firstCommitBonusMin,
    timezone,
  });

  // Aggregate statistics
  const totals = calculateTotals(sessions);
  const perAuthor = aggregateByAuthor(sessions);
  const perDay = aggregateByDay(sessions);

  // Build result
  const result: RepoStats = {
    repo: repoString,
    period: {
      since: options.since
        ? options.since instanceof Date
          ? options.since.toISOString()
          : options.since
        : undefined,
      until: options.until
        ? options.until instanceof Date
          ? options.until.toISOString()
          : options.until
        : undefined,
    },
    config: {
      sessionTimeoutMin,
      firstCommitBonusMin,
      timezone,
    },
    totals,
    perAuthor,
    perDay,
  };

  // Store in cache
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
