import { describe, it, expect, vi } from 'vitest';
import {
  parseRepoInput,
  fetchGitHubCommits,
  fetchGitHubCommitPages,
  parseNextLink,
} from '../src/api/github.js';
import { StatsError } from '../src/model/types.js';
import type { GitHubCommit } from '../src/model/types.js';

describe('GitHub API utilities', () => {
  describe('parseRepoInput', () => {
    it('should parse simple repo string', () => {
      const result = parseRepoInput({ repo: 'owner/repo' });
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should parse GitHub HTTPS URL', () => {
      const result = parseRepoInput({ url: 'https://github.com/owner/repo' });
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should parse GitHub HTTPS URL with .git suffix', () => {
      const result = parseRepoInput({ url: 'https://github.com/owner/repo.git' });
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should parse GitHub SSH URL', () => {
      const result = parseRepoInput({ url: 'git@github.com:owner/repo.git' });
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should throw error for invalid repo format', () => {
      expect(() => parseRepoInput({ repo: 'invalid' })).toThrow(StatsError);
      expect(() => parseRepoInput({ repo: 'invalid' })).toThrow('Invalid repo format');
    });

    it('should throw error for invalid URL', () => {
      expect(() => parseRepoInput({ url: 'https://gitlab.com/owner/repo' })).toThrow(
        StatsError
      );
      expect(() => parseRepoInput({ url: 'not-a-url' })).toThrow(StatsError);
    });

    it('should throw error for empty owner or repo', () => {
      expect(() => parseRepoInput({ repo: '/repo' })).toThrow(StatsError);
      expect(() => parseRepoInput({ repo: 'owner/' })).toThrow(StatsError);
      expect(() => parseRepoInput({ repo: '/' })).toThrow(StatsError);
    });
  });

  describe('fetchGitHubCommits', () => {
    function createMockGitHubCommit(
      sha: string,
      authorName: string,
      date: string,
      authorLogin?: string,
      isMerge: boolean = false
    ): GitHubCommit {
      return {
        sha,
        commit: {
          author: {
            name: authorName,
            email: 'test@example.com',
            date,
          },
          message: 'Test commit',
        },
        author: authorLogin ? { login: authorLogin, type: 'User' } : null,
        parents: isMerge ? [{ sha: 'parent1' }, { sha: 'parent2' }] : [{ sha: 'parent1' }],
      };
    }

    it('should fetch commits successfully', async () => {
      const mockCommits = [
        createMockGitHubCommit('sha1', 'Alice', '2024-01-15T14:00:00Z', 'alice'),
        createMockGitHubCommit('sha2', 'Bob', '2024-01-15T15:00:00Z', 'bob'),
      ];

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockCommits,
      });

      const commits = await fetchGitHubCommits('owner', 'repo', { fetchImpl: mockFetch });

      expect(commits).toHaveLength(2);
      expect(commits[0].sha).toBe('sha1');
      expect(commits[0].commit.author.name).toBe('Alice');
      expect(commits[1].sha).toBe('sha2');
      expect(commits[1].commit.author.name).toBe('Bob');
    });

    it('should return raw GitHub commit data', async () => {
      const mockCommits = [
        createMockGitHubCommit('sha1', 'Alice Johnson', '2024-01-15T14:00:00Z'),
      ];

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockCommits,
      });

      const commits = await fetchGitHubCommits('owner', 'repo', { fetchImpl: mockFetch });

      // Should return raw GitHub format, not transformed
      expect(commits[0]).toHaveProperty('commit');
      expect(commits[0].commit).toHaveProperty('author');
      expect(commits[0].commit.author.name).toBe('Alice Johnson');
    });

    it('should add Authorization header when token is provided', async () => {
      const mockCommits = [
        createMockGitHubCommit('sha1', 'Alice', '2024-01-15T14:00:00Z', 'alice'),
      ];

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockCommits,
      });

      await fetchGitHubCommits('owner', 'repo', {
        fetchImpl: mockFetch,
        githubToken: 'test-token',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('should add since parameter when provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      await fetchGitHubCommits('owner', 'repo', {
        fetchImpl: mockFetch,
        since: '2024-01-01T00:00:00Z',
      });

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('since=2024-01-01T00%3A00%3A00Z');
    });

    it('should add until parameter when provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      await fetchGitHubCommits('owner', 'repo', {
        fetchImpl: mockFetch,
        until: '2024-12-31T23:59:59Z',
      });

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('until=2024-12-31T23%3A59%3A59Z');
    });

    it('should handle pagination', async () => {
      const page1 = Array(100)
        .fill(null)
        .map((_, i) =>
          createMockGitHubCommit(`sha${i}`, 'Alice', '2024-01-15T14:00:00Z', 'alice')
        );
      const page2 = Array(50)
        .fill(null)
        .map((_, i) =>
          createMockGitHubCommit(`sha${i + 100}`, 'Alice', '2024-01-15T14:00:00Z', 'alice')
        );

      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => page1,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => page2,
        });

      const commits = await fetchGitHubCommits('owner', 'repo', { fetchImpl: mockFetch });

      expect(commits).toHaveLength(150);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should respect maxPages option', async () => {
      const page = Array(100)
        .fill(null)
        .map((_, i) =>
          createMockGitHubCommit(`sha${i}`, 'Alice', '2024-01-15T14:00:00Z', 'alice')
        );

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => page,
      });

      const commits = await fetchGitHubCommits('owner', 'repo', {
        fetchImpl: mockFetch,
        maxPages: 1,
      });

      expect(commits).toHaveLength(100);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should throw NOT_FOUND error for 404 response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ message: 'Not Found' }),
      });

      await expect(fetchGitHubCommits('owner', 'repo', { fetchImpl: mockFetch })).rejects.toThrow(
        StatsError
      );

      try {
        await fetchGitHubCommits('owner', 'repo', { fetchImpl: mockFetch });
      } catch (error) {
        expect((error as StatsError).code).toBe('NOT_FOUND');
      }
    });

    it('should throw UNAUTHORIZED error for 401 response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' }),
      });

      await expect(fetchGitHubCommits('owner', 'repo', { fetchImpl: mockFetch })).rejects.toThrow(
        StatsError
      );

      try {
        await fetchGitHubCommits('owner', 'repo', { fetchImpl: mockFetch });
      } catch (error) {
        expect((error as StatsError).code).toBe('UNAUTHORIZED');
      }
    });

    it('should throw RATE_LIMIT error for 403 rate limit response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ message: 'API rate limit exceeded' }),
      });

      await expect(fetchGitHubCommits('owner', 'repo', { fetchImpl: mockFetch })).rejects.toThrow(
        StatsError
      );

      try {
        await fetchGitHubCommits('owner', 'repo', { fetchImpl: mockFetch });
      } catch (error) {
        expect((error as StatsError).code).toBe('RATE_LIMIT');
      }
    });

    it('should throw NETWORK error for fetch failures', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(
        fetchGitHubCommits('owner', 'repo', { fetchImpl: mockFetch, maxRetries: 0 })
      ).rejects.toThrow(StatsError);

      try {
        await fetchGitHubCommits('owner', 'repo', { fetchImpl: mockFetch, maxRetries: 0 });
      } catch (error) {
        expect((error as StatsError).code).toBe('NETWORK');
      }
    });

    it('should handle empty response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const commits = await fetchGitHubCommits('owner', 'repo', { fetchImpl: mockFetch });

      expect(commits).toHaveLength(0);
    });
  });
});

describe('parseRepoInput edge cases', () => {
  it.each([
    ['https://github.com/owner/repo?tab=readme', 'owner', 'repo'],
    ['https://github.com/owner/repo#readme', 'owner', 'repo'],
    ['https://github.com/owner/repo/tree/main/src', 'owner', 'repo'],
    ['https://github.com/owner/repo.git', 'owner', 'repo'],
    ['https://www.github.com/owner/repo/', 'owner', 'repo'],
    ['  https://github.com/owner/repo  ', 'owner', 'repo'],
    ['git@github.com:owner/my.repo.git', 'owner', 'my.repo'],
  ])('parses URL %s', (url, owner, repo) => {
    expect(parseRepoInput({ url })).toEqual({ owner, repo });
  });

  it.each([
    ['owner/repo.git', 'owner', 'repo'],
    [' owner/repo/ ', 'owner', 'repo'],
  ])('parses repo %j', (input, owner, repo) => {
    expect(parseRepoInput({ repo: input })).toEqual({ owner, repo });
  });

  it.each(['../repo', 'owner/..', 'owner/re po', 'owner/repo?x=1', 'a/b/c'])(
    'rejects %j',
    (input) => {
      expect(() => parseRepoInput({ repo: input })).toThrow(StatsError);
    }
  );
});

describe('fetchGitHubCommits HTTP behaviour', () => {
  const commit = (sha: string): GitHubCommit => ({
    sha,
    commit: { author: { name: 'A', email: 'a@x', date: '2024-01-15T14:00:00Z' }, message: 'm' },
    author: { login: 'a', type: 'User' },
    parents: [{ sha: 'p' }],
  });
  const page = (n: number, offset = 0) => Array.from({ length: n }, (_, i) => commit(`s${offset + i}`));
  const json = (body: unknown, init: ResponseInit = {}) =>
    new Response(JSON.stringify(body), { status: 200, ...init });

  async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
    try {
      await promise;
      return undefined;
    } catch (error) {
      return (error as StatsError).code;
    }
  }

  it('clamps perPage to GitHub’s maximum of 100 so pagination continues', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(json(page(100)))
      .mockResolvedValueOnce(json(page(100, 100)))
      .mockResolvedValueOnce(json([]));

    const commits = await fetchGitHubCommits('o', 'r', { fetchImpl: mockFetch, perPage: 500 });

    expect(commits).toHaveLength(200);
    expect(mockFetch.mock.calls[0][0]).toContain('per_page=100');
  });

  it('follows the Link header and stops when there is no next link', async () => {
    const next = 'https://api.github.com/repositories/1/commits?per_page=100&page=2';
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(json(page(100), { headers: { link: `<${next}>; rel="next", <x>; rel="last"` } }))
      .mockResolvedValueOnce(json(page(100, 100), { headers: { link: '<y>; rel="prev"' } }));

    const commits = await fetchGitHubCommits('o', 'r', { fetchImpl: mockFetch });

    expect(commits).toHaveLength(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][0]).toBe(next);
  });

  it('returns no commits for an empty repository (409)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(json({ message: 'Git Repository is empty.' }, { status: 409 }));
    await expect(fetchGitHubCommits('o', 'r', { fetchImpl: mockFetch })).resolves.toEqual([]);
  });

  it('maps 429 and 403 with exhausted quota to RATE_LIMIT', async () => {
    const r429 = vi.fn().mockResolvedValue(json({ message: 'Too many requests' }, { status: 429 }));
    expect(await codeOf(fetchGitHubCommits('o', 'r', { fetchImpl: r429, maxRetries: 0 }))).toBe('RATE_LIMIT');

    const reset = String(Math.floor(Date.now() / 1000) + 3600);
    const r403 = vi.fn().mockResolvedValue(
      json({ message: 'Forbidden' }, {
        status: 403,
        headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': reset },
      })
    );
    expect(await codeOf(fetchGitHubCommits('o', 'r', { fetchImpl: r403 }))).toBe('RATE_LIMIT');
    // The reset is an hour away: fail fast instead of retrying
    expect(r403).toHaveBeenCalledTimes(1);
  });

  it('maps a secondary rate limit message to RATE_LIMIT', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(json({ message: 'You have exceeded a secondary rate limit' }, { status: 403 }));
    expect(await codeOf(fetchGitHubCommits('o', 'r', { fetchImpl: mockFetch }))).toBe('RATE_LIMIT');
  });

  it('keeps 403 without rate-limit signals as UNAUTHORIZED', async () => {
    const mockFetch = vi.fn().mockResolvedValue(json({ message: 'Resource not accessible' }, { status: 403 }));
    expect(await codeOf(fetchGitHubCommits('o', 'r', { fetchImpl: mockFetch }))).toBe('UNAUTHORIZED');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('retries rate limits that carry a short Retry-After', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(json({ message: 'secondary rate limit' }, { status: 429, headers: { 'retry-after': '0' } }))
      .mockResolvedValueOnce(json(page(3)));

    await expect(fetchGitHubCommits('o', 'r', { fetchImpl: mockFetch })).resolves.toHaveLength(3);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('retries server errors and network failures with backoff', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(json({ message: 'Bad gateway' }, { status: 502 }))
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(json(page(2)));

    const commits = await fetchGitHubCommits('o', 'r', { fetchImpl: mockFetch, retryBaseDelayMs: 0 });

    expect(commits).toHaveLength(2);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('gives up after maxRetries', async () => {
    const mockFetch = vi.fn().mockResolvedValue(json({ message: 'boom' }, { status: 500 }));
    expect(
      await codeOf(fetchGitHubCommits('o', 'r', { fetchImpl: mockFetch, maxRetries: 2, retryBaseDelayMs: 0 }))
    ).toBe('UNKNOWN');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('hints at private repositories on 404 without a token', async () => {
    const mockFetch = vi.fn().mockResolvedValue(json({ message: 'Not Found' }, { status: 404 }));
    await expect(fetchGitHubCommits('o', 'r', { fetchImpl: mockFetch })).rejects.toThrow(/githubToken/);
  });

  it('encodes owner and repo in the request path', async () => {
    const mockFetch = vi.fn().mockResolvedValue(json([]));
    await fetchGitHubCommits('o', 'r.js', { fetchImpl: mockFetch });
    expect(mockFetch.mock.calls[0][0]).toMatch(/^https:\/\/api\.github\.com\/repos\/o\/r\.js\/commits\?/);
  });
});

describe('parseNextLink', () => {
  it('extracts the next URL', () => {
    expect(parseNextLink('<https://a/2>; rel="next", <https://a/5>; rel="last"')).toBe('https://a/2');
    expect(parseNextLink('<https://a/1>; rel="prev"')).toBeUndefined();
  });

});

describe('fetchGitHubCommits default invocation', () => {
  it('calls fetchImpl without binding it to another object (browser fetch requires this)', async () => {
    const strictFetch = function (this: unknown) {
      if (this !== undefined && this !== globalThis) {
        throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
      }
      return Promise.resolve(new Response('[]'));
    } as unknown as typeof fetch;

    await expect(fetchGitHubCommits('o', 'r', { fetchImpl: strictFetch, maxRetries: 0 })).resolves.toEqual([]);
  });
});

describe('fetchGitHubCommitPages truncation', () => {
  const commit = (sha: string): GitHubCommit => ({
    sha,
    commit: { author: { name: 'A', email: 'a@x', date: '2024-01-15T14:00:00Z' }, message: 'm' },
    author: { login: 'a', type: 'User' },
    parents: [{ sha: 'p' }],
  });
  const page = (n: number) => Array.from({ length: n }, (_, i) => commit(`s${i}`));
  const respond = (body: unknown, headers?: Record<string, string>) =>
    new Response(JSON.stringify(body), { status: 200, headers });

  it('is truncated when maxPages stops before a next page (Link header)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(respond(page(100), { link: '<https://a/2>; rel="next"' }));
    const result = await fetchGitHubCommitPages('o', 'r', { fetchImpl: mockFetch, maxPages: 1 });
    expect(result).toMatchObject({ truncated: true });
    expect(result.commits).toHaveLength(100);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('is truncated when maxPages stops on a full page without a Link header', async () => {
    const mockFetch = vi.fn().mockResolvedValue(respond(page(100)));
    const result = await fetchGitHubCommitPages('o', 'r', { fetchImpl: mockFetch, maxPages: 1 });
    expect(result.truncated).toBe(true);
  });

  it('is not truncated when the last page is reached exactly at maxPages', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(respond(page(100), { link: '<https://a/2>; rel="next"' }))
      .mockResolvedValueOnce(respond(page(10), { link: '<https://a/1>; rel="prev"' }));
    const result = await fetchGitHubCommitPages('o', 'r', { fetchImpl: mockFetch, maxPages: 2 });
    expect(result.truncated).toBe(false);
    expect(result.commits).toHaveLength(110);
  });

  it('is not truncated without maxPages or for empty repositories', async () => {
    const full = vi.fn().mockResolvedValueOnce(respond(page(5)));
    expect((await fetchGitHubCommitPages('o', 'r', { fetchImpl: full })).truncated).toBe(false);

    const empty = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'empty' }), { status: 409 }));
    expect(await fetchGitHubCommitPages('o', 'r', { fetchImpl: empty, maxPages: 1 })).toEqual({
      commits: [],
      truncated: false,
    });
  });
});
