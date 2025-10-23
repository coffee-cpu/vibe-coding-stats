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
  perPage?: number; // default: 100
  maxPages?: number;
  useGraphQL?: boolean; // default: false
  cache?: 'memory' | 'none'; // default: 'memory'
  cacheTTLms?: number; // default: 15 min
}

// Output types
export interface RepoStats {
  repo: string;
  period: { since?: string; until?: string };
  config: {
    sessionTimeoutMin: number;
    firstCommitBonusMin: number;
    timezone: string;
  };
  totals: {
    totalHours: number;
    sessionsCount: number;
    devDays: number;
    totalCommits: number;
    avgCommitsPerSession: number;
    avgSessionsPerDay: number;
    longestSessionHours: number;
  };
  perAuthor: AuthorStats[];
  perDay: DayStats[];
  raw?: {
    commitSample?: Array<{
      sha: string;
      authorLogin?: string;
      authorName?: string;
      date: string;
    }>;
  };
}

export interface AuthorStats {
  author: string;
  totalHours: number;
  sessionsCount: number;
  totalCommits: number;
  longestSessionHours: number;
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
  author: string;
  authorLogin?: string;
  date: Date;
  message: string;
  isMerge?: boolean;
  isBot?: boolean;
}

export interface Session {
  author: string;
  commits: Commit[];
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  date: string; // ISO date string of session start in configured timezone
}

// Error types
export type StatsErrorCode =
  | 'INVALID_REPO'
  | 'NOT_FOUND'
  | 'RATE_LIMIT'
  | 'NETWORK'
  | 'UNAUTHORIZED'
  | 'UNSUPPORTED_PRIVATE_REPO'
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
