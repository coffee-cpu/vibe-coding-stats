import type {
  Commit,
  GitHubCommit,
  GitHubErrorResponse,
  RepoInput,
  StatsOptions,
  StatsErrorCode,
} from '../model/types.js';
import { StatsError } from '../model/types.js';

const BOT_PATTERNS = [
  'bot',
  'dependabot',
  'renovate',
  'github-actions',
  'greenkeeper',
  'snyk',
  'codecov',
  'travis',
  'circleci',
  '[bot]',
];

/**
 * Parse repo input to extract owner and repo name
 */
export function parseRepoInput(input: RepoInput): { owner: string; repo: string } {
  let repoString: string;

  if ('repo' in input) {
    repoString = input.repo;
  } else {
    // Parse URL
    const url = input.url.replace(/\.git$/, '');
    const match = url.match(/github\.com[:/]([^/]+)\/([^/]+)/);
    if (!match) {
      throw new StatsError('INVALID_REPO', `Invalid GitHub URL: ${input.url}`);
    }
    repoString = `${match[1]}/${match[2]}`;
  }

  const parts = repoString.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new StatsError('INVALID_REPO', `Invalid repo format: ${repoString}`);
  }

  return { owner: parts[0], repo: parts[1] };
}

/**
 * Check if a commit author is likely a bot
 */
function isLikelyBot(authorName: string, authorLogin?: string): boolean {
  const nameLower = authorName.toLowerCase();
  const loginLower = authorLogin?.toLowerCase() || '';

  return BOT_PATTERNS.some(
    (pattern) => nameLower.includes(pattern) || loginLower.includes(pattern)
  );
}

/**
 * Fetch commits from GitHub REST API
 */
export async function fetchCommits(
  owner: string,
  repo: string,
  options: StatsOptions = {}
): Promise<Commit[]> {
  const {
    githubToken,
    since,
    until,
    authors,
    excludeBots = true,
    excludeMergeCommits = false,
    perPage = 100,
    maxPages,
    fetchImpl = fetch,
  } = options;

  const commits: Commit[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = new URL(`https://api.github.com/repos/${owner}/${repo}/commits`);
    url.searchParams.set('per_page', String(perPage));
    url.searchParams.set('page', String(page));

    if (since) {
      const sinceDate = since instanceof Date ? since.toISOString() : since;
      url.searchParams.set('since', sinceDate);
    }

    if (until) {
      const untilDate = until instanceof Date ? until.toISOString() : until;
      url.searchParams.set('until', untilDate);
    }

    const headers: HeadersInit = {
      Accept: 'application/vnd.github.v3+json',
    };

    if (githubToken) {
      headers.Authorization = `Bearer ${githubToken}`;
    }

    try {
      const response = await fetchImpl(url.toString(), { headers });

      if (!response.ok) {
        await handleGitHubError(response);
      }

      const data = (await response.json()) as GitHubCommit[];

      if (data.length === 0) {
        hasMore = false;
        break;
      }

      for (const ghCommit of data) {
        const authorName = ghCommit.commit.author.name;
        const authorLogin = ghCommit.author?.login;
        const isBot = isLikelyBot(authorName, authorLogin);
        const isMerge = (ghCommit.parents?.length || 0) > 1;

        // Apply filters
        if (excludeBots && isBot) continue;
        if (excludeMergeCommits && isMerge) continue;
        if (authors && authors.length > 0) {
          const matchesAuthor = authors.some(
            (a) =>
              a.toLowerCase() === authorName.toLowerCase() ||
              a.toLowerCase() === authorLogin?.toLowerCase()
          );
          if (!matchesAuthor) continue;
        }

        commits.push({
          sha: ghCommit.sha,
          author: authorLogin || authorName,
          authorLogin,
          date: new Date(ghCommit.commit.author.date),
          message: ghCommit.commit.message,
          isMerge,
          isBot,
        });
      }

      // Check if there are more pages
      if (data.length < perPage) {
        hasMore = false;
      } else if (maxPages && page >= maxPages) {
        hasMore = false;
      } else {
        page++;
      }
    } catch (error) {
      if (error instanceof StatsError) {
        throw error;
      }
      throw new StatsError('NETWORK', `Failed to fetch commits: ${String(error)}`, error);
    }
  }

  return commits;
}

/**
 * Handle GitHub API errors
 */
async function handleGitHubError(response: Response): Promise<never> {
  const status = response.status;
  let errorCode: StatsErrorCode = 'UNKNOWN';
  let message = `GitHub API error: ${status}`;

  try {
    const errorData = (await response.json()) as GitHubErrorResponse;
    message = errorData.message || message;
  } catch {
    // Ignore JSON parse errors
  }

  if (status === 404) {
    errorCode = 'NOT_FOUND';
    message = 'Repository not found';
  } else if (status === 401) {
    errorCode = 'UNAUTHORIZED';
    message = 'Invalid or missing GitHub token';
  } else if (status === 403) {
    if (message.toLowerCase().includes('rate limit')) {
      errorCode = 'RATE_LIMIT';
      message = 'GitHub API rate limit exceeded';
    } else {
      errorCode = 'UNAUTHORIZED';
    }
  }

  throw new StatsError(errorCode, message, { status, response });
}
