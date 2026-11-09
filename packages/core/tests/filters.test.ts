import { describe, it, expect } from 'vitest';
import { isLikelyBot, isMergeCommit, shouldIncludeCommit } from '../src/logic/filters.js';
import { transformGitHubCommit, unifyAuthorIdentities } from '../src/logic/transform.js';
import type { Commit, GitHubCommit } from '../src/model/types.js';

function ghCommit(overrides: {
  sha?: string;
  name?: string;
  email?: string;
  login?: string | null;
  type?: string;
  date?: string;
  parents?: number;
}): GitHubCommit {
  const {
    sha = 'sha',
    name = 'Alice',
    email = 'alice@example.com',
    login = 'alice',
    type = 'User',
  } = overrides;
  return {
    sha,
    commit: {
      author: { name, email, date: overrides.date ?? '2024-01-15T14:00:00Z' },
      message: 'msg',
    },
    author: login ? { login, type } : null,
    parents: Array.from({ length: overrides.parents ?? 1 }, (_, i) => ({ sha: `p${i}` })),
  };
}

describe('isLikelyBot', () => {
  it.each([
    ['dependabot[bot]', 'dependabot[bot]'],
    ['renovate[bot]', 'renovate[bot]'],
    ['github-actions[bot]', 'github-actions[bot]'],
    ['GitHub Actions', 'github-actions'],
    ['Renovate Bot', undefined],
    ['release-bot', undefined],
    ['snyk-bot', undefined],
    ['Travis CI', undefined],
  ])('detects %s', (name, login) => {
    expect(isLikelyBot(name, login)).toBe(true);
  });

  it.each([
    ['Jane Abbott', undefined],
    ['Ann Talbot', 'talbot'],
    ['Botond Kiss', 'botond'],
    ['Travis Scott', 'travis'],
    ['Robotics Team', 'roboticsteam'],
  ])('does not flag the human %s', (name, login) => {
    expect(isLikelyBot(name, login)).toBe(false);
  });

  it('trusts the GitHub account type', () => {
    expect(isLikelyBot('Some Automation', 'some-automation', 'Bot')).toBe(true);
    expect(isLikelyBot('Ann Talbot', 'talbot', 'User')).toBe(false);
  });
});

describe('isMergeCommit', () => {
  it('flags commits with more than one parent', () => {
    expect(isMergeCommit(ghCommit({ parents: 2 }))).toBe(true);
    expect(isMergeCommit(ghCommit({ parents: 1 }))).toBe(false);
  });
});

describe('shouldIncludeCommit', () => {
  const commit = (o: Parameters<typeof ghCommit>[0]): Commit => transformGitHubCommit(ghCommit(o));

  it('excludes bots by default and keeps them when asked', () => {
    const bot = commit({ name: 'dependabot[bot]', login: 'dependabot[bot]', type: 'Bot' });
    expect(shouldIncludeCommit(bot, {})).toBe(false);
    expect(shouldIncludeCommit(bot, { excludeBots: false })).toBe(true);
  });

  it('excludes merge commits only when asked', () => {
    const merge = commit({ parents: 2 });
    expect(shouldIncludeCommit(merge, {})).toBe(true);
    expect(shouldIncludeCommit(merge, { excludeMergeCommits: true })).toBe(false);
  });

  it('matches authors by login or git name, case-insensitively', () => {
    const c = commit({ name: 'Alice Smith', login: 'alice' });
    expect(shouldIncludeCommit(c, { authors: ['ALICE'] })).toBe(true);
    expect(shouldIncludeCommit(c, { authors: ['alice smith'] })).toBe(true);
    expect(shouldIncludeCommit(c, { authors: ['bob'] })).toBe(false);
  });

  it('applies since/until to the author date', () => {
    const c = commit({ date: '2024-01-15T14:00:00Z' });
    expect(shouldIncludeCommit(c, { since: '2024-01-15T14:00:00Z' })).toBe(true);
    expect(shouldIncludeCommit(c, { since: '2024-01-16' })).toBe(false);
    expect(shouldIncludeCommit(c, { until: new Date('2024-01-15T13:59:59Z') })).toBe(false);
    expect(shouldIncludeCommit(c, { since: '2024-01-01', until: '2024-02-01' })).toBe(true);
  });
});

describe('unifyAuthorIdentities', () => {
  it('attributes unlinked commits to the login with the same email', () => {
    const commits = [
      transformGitHubCommit(
        ghCommit({ sha: 'a', name: 'Alice', email: 'a@x.com', login: 'alice' })
      ),
      transformGitHubCommit(
        ghCommit({ sha: 'b', name: 'Alice (laptop)', email: 'A@x.com', login: null })
      ),
    ];
    const unified = unifyAuthorIdentities(commits);
    expect(unified.map((c) => c.author)).toEqual(['alice', 'alice']);
    expect(unified[1].authorLogin).toBe('alice');
  });

  it('attributes unlinked commits by name when the name maps to exactly one login', () => {
    const commits = [
      transformGitHubCommit(
        ghCommit({ sha: 'a', name: 'Alice', email: 'a@work.com', login: 'alice' })
      ),
      transformGitHubCommit(
        ghCommit({ sha: 'b', name: 'alice', email: 'a@home.com', login: null })
      ),
    ];
    expect(unifyAuthorIdentities(commits)[1].author).toBe('alice');
  });

  it('leaves ambiguous names alone', () => {
    const commits = [
      transformGitHubCommit(ghCommit({ sha: 'a', name: 'Sam', email: '1@x.com', login: 'sam1' })),
      transformGitHubCommit(ghCommit({ sha: 'b', name: 'Sam', email: '2@x.com', login: 'sam2' })),
      transformGitHubCommit(ghCommit({ sha: 'c', name: 'Sam', email: '3@x.com', login: null })),
    ];
    expect(unifyAuthorIdentities(commits)[2].author).toBe('Sam');
  });
});
