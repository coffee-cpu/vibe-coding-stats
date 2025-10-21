import type { Commit, GitHubCommit } from '../model/types.js';
import { isLikelyBot, isMergeCommit } from './filters.js';

/**
 * Transform a GitHub API commit to our internal Commit type
 */
export function transformGitHubCommit(ghCommit: GitHubCommit): Commit {
  const authorName = ghCommit.commit.author.name;
  const authorLogin = ghCommit.author?.login;
  const isBot = isLikelyBot(authorName, authorLogin);
  const isMerge = isMergeCommit(ghCommit);

  return {
    sha: ghCommit.sha,
    author: authorLogin || authorName,
    authorLogin,
    date: new Date(ghCommit.commit.author.date),
    message: ghCommit.commit.message,
    isMerge,
    isBot,
  };
}
