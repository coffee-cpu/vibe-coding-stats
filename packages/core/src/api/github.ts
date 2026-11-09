import type {
  GitHubCommit,
  GitHubErrorResponse,
  RepoInput,
  StatsErrorCode,
} from '../model/types.js';
import { StatsError } from '../model/types.js';
import { toDateString } from '../util/time.js';

const GITHUB_API = 'https://api.github.com';
/** GitHub caps `per_page` at 100 */
export const MAX_PER_PAGE = 100;
/** Never wait longer than this for a single retry; longer waits fail fast with RATE_LIMIT */
export const MAX_RETRY_WAIT_MS = 60_000;

const NAME_PATTERN = /^[A-Za-z0-9_.-]+$/;

/**
 * Parse repo input to extract owner and repo name
 */
export function parseRepoInput(input: RepoInput): { owner: string; repo: string } {
  let owner: string | undefined;
  let repo: string | undefined;

  if ('repo' in input) {
    const parts = input.repo.trim().replace(/\/+$/, '').split('/');
    if (parts.length === 2) {
      [owner, repo] = parts;
    }
  } else {
    // https://github.com/o/r, git@github.com:o/r.git, …/o/r/tree/main, …/o/r?tab=readme#top
    const match = input.url.trim().match(/github\.com[:/]+([^/?#\s]+)\/([^/?#\s]+)/i);
    if (!match) {
      throw new StatsError('INVALID_REPO', `Invalid GitHub URL: ${input.url}`);
    }
    [, owner, repo] = match;
  }

  repo = repo?.replace(/\.git$/i, '');

  if (!owner || !repo || !isValidName(owner) || !isValidName(repo)) {
    const raw = 'repo' in input ? input.repo : input.url;
    throw new StatsError('INVALID_REPO', `Invalid repo format: ${raw}`);
  }

  return { owner, repo };
}

function isValidName(name: string): boolean {
  return NAME_PATTERN.test(name) && name !== '.' && name !== '..';
}

/**
 * Options for fetching GitHub commits
 */
export interface FetchGitHubCommitsOptions {
  githubToken?: string;
  since?: string | Date;
  until?: string | Date;
  perPage?: number;
  maxPages?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Fetch raw commits from GitHub REST API (no filtering or transformation).
 *
 * Follows the `Link` header for pagination, treats an empty repository (HTTP 409)
 * as zero commits, and retries network errors, 5xx responses and short
 * rate-limit waits with exponential backoff.
 */
export async function fetchGitHubCommits(
  owner: string,
  repo: string,
  options: FetchGitHubCommitsOptions = {}
): Promise<GitHubCommit[]> {
  const {
    githubToken,
    since,
    until,
    perPage: requestedPerPage = MAX_PER_PAGE,
    maxPages,
    maxRetries = 2,
    retryBaseDelayMs = 1000,
    fetchImpl = (input, init) => globalThis.fetch(input, init),
  } = options;

  const perPage = Math.max(1, Math.min(MAX_PER_PAGE, Math.floor(requestedPerPage)));

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  const firstUrl = new URL(
    `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits`
  );
  firstUrl.searchParams.set('per_page', String(perPage));
  firstUrl.searchParams.set('page', '1');
  if (since) firstUrl.searchParams.set('since', toDateString(since));
  if (until) firstUrl.searchParams.set('until', toDateString(until));

  const commits: GitHubCommit[] = [];
  let nextUrl: string | undefined = firstUrl.toString();
  let page = 1;

  while (nextUrl) {
    const response = await fetchWithRetry(nextUrl, { headers }, {
      fetchImpl,
      maxRetries,
      retryBaseDelayMs,
      hasToken: Boolean(githubToken),
    });

    if (response.status === 409) {
      // "Git Repository is empty."
      return [];
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch (error) {
      throw new StatsError('NETWORK', `Failed to parse GitHub response: ${String(error)}`, error);
    }
    if (!Array.isArray(data)) {
      throw new StatsError('UNKNOWN', 'Unexpected response from GitHub API', { data });
    }

    commits.push(...(data as GitHubCommit[]));

    if (data.length === 0 || (maxPages && page >= maxPages)) break;

    const linkHeader = getHeader(response, 'link');
    if (linkHeader !== null) {
      nextUrl = parseNextLink(linkHeader);
    } else {
      // No Link header (e.g. a minimal mock): fall back to page size heuristics
      if (data.length < perPage) break;
      const url = new URL(nextUrl);
      url.searchParams.set('page', String(page + 1));
      nextUrl = url.toString();
    }
    page++;
  }

  return commits;
}

/**
 * Extract the rel="next" URL from a GitHub Link header
 */
export function parseNextLink(linkHeader: string): string | undefined {
  for (const part of linkHeader.split(',')) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="?next"?/);
    if (match) return match[1];
  }
  return undefined;
}

interface RetryContext {
  fetchImpl: typeof fetch;
  maxRetries: number;
  retryBaseDelayMs: number;
  hasToken: boolean;
}

/**
 * Perform a request, retrying transient failures. Returns successful responses
 * and 409 (empty repository); throws StatsError for everything else.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  ctx: RetryContext
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      // Call as a plain function: browsers throw "Illegal invocation" when
      // fetch is invoked with `this` set to another object
      const { fetchImpl } = ctx;
      response = await fetchImpl(url, init);
    } catch (error) {
      if (attempt < ctx.maxRetries) {
        await sleep(backoff(attempt, ctx.retryBaseDelayMs));
        continue;
      }
      throw new StatsError('NETWORK', `Failed to fetch commits: ${String(error)}`, error);
    }

    if (response.ok || response.status === 409) {
      return response;
    }

    const error = await toStatsError(response, ctx.hasToken);
    const waitMs = retryWaitMs(response, error, attempt, ctx.retryBaseDelayMs);
    if (attempt < ctx.maxRetries && waitMs !== undefined && waitMs <= MAX_RETRY_WAIT_MS) {
      await sleep(waitMs);
      continue;
    }
    throw error;
  }
}

/**
 * How long to wait before retrying, or undefined if the error is not retryable
 */
function retryWaitMs(
  response: Response,
  error: StatsError,
  attempt: number,
  baseDelayMs: number
): number | undefined {
  if (error.code === 'RATE_LIMIT') {
    const retryAfter = Number(getHeader(response, 'retry-after'));
    if (getHeader(response, 'retry-after') !== null && Number.isFinite(retryAfter)) {
      return retryAfter * 1000;
    }
    const resetAt = Number(getHeader(response, 'x-ratelimit-reset'));
    if (getHeader(response, 'x-ratelimit-remaining') === '0' && Number.isFinite(resetAt) && resetAt > 0) {
      return Math.max(0, resetAt * 1000 - Date.now());
    }
    // No hint about when the limit lifts: fail fast rather than guess
    return undefined;
  }
  if (response.status >= 500) {
    return backoff(attempt, baseDelayMs);
  }
  return undefined;
}

function backoff(attempt: number, baseDelayMs: number): number {
  return baseDelayMs * 2 ** attempt;
}

function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

/**
 * Read a header defensively (mocked responses may have no headers object)
 */
function getHeader(response: Response, name: string): string | null {
  return typeof response.headers?.get === 'function' ? response.headers.get(name) : null;
}

/**
 * Map a failed GitHub response to a StatsError
 */
async function toStatsError(response: Response, hasToken: boolean): Promise<StatsError> {
  const status = response.status;
  let errorCode: StatsErrorCode = 'UNKNOWN';
  let message = `GitHub API error: ${status}`;

  try {
    const errorData = (await response.json()) as GitHubErrorResponse;
    message = errorData.message || message;
  } catch {
    // Ignore JSON parse errors
  }

  const remaining = getHeader(response, 'x-ratelimit-remaining');
  const reset = getHeader(response, 'x-ratelimit-reset');
  const isRateLimited =
    status === 429 || (status === 403 && (remaining === '0' || /rate limit/i.test(message)));

  if (status === 404) {
    errorCode = 'NOT_FOUND';
    message = hasToken
      ? 'Repository not found'
      : 'Repository not found (private repositories require a githubToken with access)';
  } else if (status === 401) {
    errorCode = 'UNAUTHORIZED';
    message = 'Invalid or missing GitHub token';
  } else if (isRateLimited) {
    errorCode = 'RATE_LIMIT';
    const resetAt = reset ? new Date(Number(reset) * 1000) : undefined;
    message = resetAt && !Number.isNaN(resetAt.getTime())
      ? `GitHub API rate limit exceeded (resets at ${resetAt.toISOString()})`
      : 'GitHub API rate limit exceeded';
  } else if (status === 403) {
    errorCode = 'UNAUTHORIZED';
  }

  return new StatsError(errorCode, message, { status, response, rateLimitReset: reset ?? undefined });
}
