import type { GitHubCommit, StatsOptions } from '../model/types.js';

/**
 * Common bot patterns to detect automated commits
 */
export const BOT_PATTERNS = [
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
 * Check if a commit author is likely a bot
 */
export function isLikelyBot(authorName: string, authorLogin?: string): boolean {
  const nameLower = authorName.toLowerCase();
  const loginLower = authorLogin?.toLowerCase() || '';

  return BOT_PATTERNS.some(
    (pattern) => nameLower.includes(pattern) || loginLower.includes(pattern)
  );
}

/**
 * Check if a commit is a merge commit
 */
export function isMergeCommit(ghCommit: GitHubCommit): boolean {
  return (ghCommit.parents?.length || 0) > 1;
}

/**
 * Check if a commit should be included based on filter options
 */
export function shouldIncludeCommit(
  ghCommit: GitHubCommit,
  options: Pick<StatsOptions, 'excludeBots' | 'excludeMergeCommits' | 'authors'>
): boolean {
  const { excludeBots = true, excludeMergeCommits = false, authors } = options;

  const authorName = ghCommit.commit.author.name;
  const authorLogin = ghCommit.author?.login;
  const isBot = isLikelyBot(authorName, authorLogin);
  const isMerge = isMergeCommit(ghCommit);

  // Apply filters
  if (excludeBots && isBot) return false;
  if (excludeMergeCommits && isMerge) return false;

  if (authors && authors.length > 0) {
    const matchesAuthor = authors.some(
      (a) =>
        a.toLowerCase() === authorName.toLowerCase() ||
        a.toLowerCase() === authorLogin?.toLowerCase()
    );
    if (!matchesAuthor) return false;
  }

  return true;
}
