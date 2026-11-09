import type { Commit, GitHubCommit } from '../model/types.js';
import { isLikelyBot, isMergeCommit } from './filters.js';

/**
 * Transform a GitHub API commit to our internal Commit type
 */
export function transformGitHubCommit(ghCommit: GitHubCommit): Commit {
  const authorName = ghCommit.commit.author.name;
  const authorEmail = ghCommit.commit.author.email;
  const authorLogin = ghCommit.author?.login;
  const authorType = ghCommit.author?.type;

  return {
    sha: ghCommit.sha,
    author: authorLogin || authorName,
    authorLogin,
    authorName,
    authorEmail,
    authorType,
    date: new Date(ghCommit.commit.author.date),
    message: ghCommit.commit.message,
    isMerge: isMergeCommit(ghCommit),
    isBot: isLikelyBot(authorName, authorLogin, authorType),
  };
}

/**
 * Attribute commits that GitHub could not link to an account (e.g. made from a
 * machine with an unregistered email) to the matching GitHub login, so the same
 * person is not split into two authors.
 *
 * A commit without a login is matched to a login by author email first, then by
 * author name, using the other commits in the same set. Ambiguous names (used by
 * more than one login) are left untouched.
 */
export function unifyAuthorIdentities(commits: Commit[]): Commit[] {
  const loginByEmail = new Map<string, string>();
  const loginsByName = new Map<string, Set<string>>();

  for (const c of commits) {
    if (!c.authorLogin) continue;
    if (c.authorEmail) loginByEmail.set(c.authorEmail.toLowerCase(), c.authorLogin);
    if (c.authorName) {
      const key = c.authorName.toLowerCase();
      const logins = loginsByName.get(key) ?? new Set<string>();
      logins.add(c.authorLogin);
      loginsByName.set(key, logins);
    }
  }

  return commits.map((c) => {
    if (c.authorLogin) return c;

    let login = c.authorEmail ? loginByEmail.get(c.authorEmail.toLowerCase()) : undefined;
    if (!login && c.authorName) {
      const logins = loginsByName.get(c.authorName.toLowerCase());
      if (logins?.size === 1) login = [...logins][0];
    }

    return login ? { ...c, author: login, authorLogin: login } : c;
  });
}
