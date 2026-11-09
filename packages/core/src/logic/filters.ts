import type { Commit, GitHubCommit, StatsOptions } from '../model/types.js';
import { toDate } from '../util/time.js';

/**
 * Names of well-known automation accounts. Matched as whole words
 * (so "snyk-bot" matches "snyk", but "Talbot" does not match "bot").
 * Generic first names (e.g. "Travis") are deliberately not listed on their own.
 */
export const BOT_NAMES = [
  'bot',
  'dependabot',
  'renovate',
  'github-actions',
  'greenkeeper',
  'snyk',
  'codecov',
  'travis-ci',
  'travis ci',
  'circleci',
  'mergify',
  'semantic-release',
  'imgbot',
  'allcontributors',
  'pre-commit-ci',
];

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');

const BOT_WORD_PATTERN = new RegExp(
  '(^|[^a-z0-9])(' + BOT_NAMES.map(escapeRegExp).join('|') + ')($|[^a-z0-9])',
  'i'
);

/**
 * Check if a commit author is likely a bot.
 *
 * Uses, in order: GitHub's own account type, the `[bot]` login suffix used by
 * GitHub Apps, and whole-word matches against well-known automation names.
 */
export function isLikelyBot(authorName: string, authorLogin?: string, authorType?: string): boolean {
  if (authorType?.toLowerCase() === 'bot') return true;

  const login = authorLogin?.toLowerCase() ?? '';
  const name = authorName.toLowerCase();
  if (login.endsWith('[bot]') || name.endsWith('[bot]')) return true;

  return BOT_WORD_PATTERN.test(name) || BOT_WORD_PATTERN.test(login);
}

/**
 * Check if a commit is a merge commit
 */
export function isMergeCommit(ghCommit: GitHubCommit): boolean {
  return (ghCommit.parents?.length ?? 0) > 1;
}

export type CommitFilterOptions = Pick<
  StatsOptions,
  'excludeBots' | 'excludeMergeCommits' | 'authors' | 'since' | 'until'
>;

/**
 * Check if a commit should be included based on filter options.
 *
 * The date range is re-applied to the author date: GitHub's `since`/`until`
 * parameters filter on committer date, which differs for rebased or
 * cherry-picked commits, while sessions are built from author dates.
 */
export function shouldIncludeCommit(commit: Commit, options: CommitFilterOptions): boolean {
  const { excludeBots = true, excludeMergeCommits = false, authors, since, until } = options;

  if (excludeBots && commit.isBot) return false;
  if (excludeMergeCommits && commit.isMerge) return false;

  const time = commit.date.getTime();
  if (since && time < toDate(since).getTime()) return false;
  if (until && time > toDate(until).getTime()) return false;

  if (authors && authors.length > 0) {
    const candidates = [commit.author, commit.authorLogin, commit.authorName]
      .filter((v): v is string => Boolean(v))
      .map((v) => v.toLowerCase());
    const matchesAuthor = authors.some((a) => candidates.includes(a.toLowerCase()));
    if (!matchesAuthor) return false;
  }

  return true;
}
