// Input types
/**
 * Repository identifier - accepts either a short repo format or full GitHub URL
 *
 * @example
 * // Using short format
 * { repo: 'owner/repo' }
 *
 * @example
 * // Using full URL
 * { url: 'https://github.com/owner/repo' }
 */
export type RepoInput = { repo: string } | { url: string };

export interface StatsOptions {
  sessionTimeoutMin?: number; // default: 45
  firstCommitBonusMin?: number; // default: 15
  since?: string | Date;
  until?: string | Date;
  authors?: string[];
  excludeBots?: boolean; // default: true
  excludeMergeCommits?: boolean; // default: false
  timezone?: string; // default: "UTC"
  githubToken?: string; // optional for higher rate limit
  fetchImpl?: typeof fetch;
  perPage?: number; // default: 100 (GitHub maximum; larger values are clamped)
  maxPages?: number; // default: unlimited
  /** Retries for network errors, 5xx responses and short rate-limit waits. Default: 2 */
  maxRetries?: number;
  /** Base delay for exponential retry backoff, in ms. Default: 1000 */
  retryBaseDelayMs?: number;
  /** @deprecated Has never had any effect and will be removed in the next major version. */
  useGraphQL?: boolean;
  cache?: 'memory' | 'none'; // default: 'memory'
  cacheTTLms?: number; // default: 900000 (15 min)
}

// Output types
export interface AggregateStats {
  totalHours: number;
  sessionsCount: number;
  /** Number of distinct days (in the configured timezone) on which at least one session started */
  devDays: number;
  totalCommits: number;
  avgCommitsPerSession: number;
  avgSessionsPerDay: number;
  longestSessionHours: number;
  avgSessionHours: number;
  /** Day of week with most total coding hours (e.g., "Monday", "Tuesday"). Undefined if no sessions. */
  mostProductiveDayOfWeek?: string;
  /** Longest run of consecutive days on which a session started */
  longestStreakDays: number;
  /** Minimum time between consecutive sessions by the same author in minutes. Undefined if no author has 2+ sessions. */
  minTimeBetweenSessionsMin?: number;
  /** Average time in minutes between consecutive commits within sessions across all authors. Undefined if all sessions are single-commit. */
  avgMinutesBetweenCommits?: number;
  /** Maximum time in minutes between consecutive commits within sessions across all authors. Undefined if all sessions are single-commit. */
  maxMinutesBetweenCommits?: number;
}

export interface RepoStats {
  repo: string;
  period: { since?: string; until?: string };
  config: {
    sessionTimeoutMin: number;
    firstCommitBonusMin: number;
    timezone: string;
  };
  totals: AggregateStats;
  perAuthor: AuthorStats[];
  perDay: DayStats[];
  /** @deprecated Never populated; will be removed in the next major version. */
  raw?: {
    commitSample?: Array<{
      sha: string;
      authorLogin?: string;
      authorName?: string;
      date: string;
    }>;
  };
}

export interface AuthorStats extends AggregateStats {
  author: string;
  /** GitHub username if available. Profile URL: https://github.com/{authorLogin} */
  authorLogin?: string;
}

export interface DayStats {
  date: string; // ISO date string (YYYY-MM-DD)
  totalHours: number;
  sessionsCount: number;
  totalCommits: number;
  authors: string[];
}

// Internal types
export interface Commit {
  sha: string;
  /** Identity used for grouping: GitHub login when known, otherwise the git author name */
  author: string;
  authorLogin?: string;
  /** Git author name as recorded in the commit */
  authorName?: string;
  /** Git author email as recorded in the commit */
  authorEmail?: string;
  /** GitHub account type ("User", "Bot", ...) when the commit is linked to an account */
  authorType?: string;
  date: Date;
  message: string;
  isMerge?: boolean;
  isBot?: boolean;
}

export interface Session {
  author: string;
  authorLogin?: string;
  commits: Commit[];
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  date: string; // ISO date string of session start in configured timezone
  /** Average time in minutes between consecutive commits in this session. Undefined for single-commit sessions. */
  avgMinutesBetweenCommits?: number;
  /** Maximum time in minutes between consecutive commits in this session. Undefined for single-commit sessions. */
  maxMinutesBetweenCommits?: number;
}

// Error types
export type StatsErrorCode =
  | 'INVALID_REPO'
  | 'NOT_FOUND'
  | 'RATE_LIMIT'
  | 'NETWORK'
  | 'UNAUTHORIZED'
  /** @deprecated Never thrown: GitHub answers 404 for private repos without access, reported as NOT_FOUND. */
  | 'UNSUPPORTED_PRIVATE_REPO'
  | 'INVALID_OPTIONS'
  | 'UNKNOWN';

export class StatsError extends Error {
  constructor(
    public code: StatsErrorCode,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'StatsError';
  }
}

// GitHub API types
export interface GitHubCommit {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
  author?: {
    login: string;
    type: string;
  } | null;
  parents?: Array<{ sha: string }>;
}

export interface GitHubErrorResponse {
  message: string;
  documentation_url?: string;
}
