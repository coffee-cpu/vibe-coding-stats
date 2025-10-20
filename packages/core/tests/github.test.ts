import { describe, it, expect, vi } from 'vitest';
import { parseRepoInput, fetchCommits } from '../src/api/github.js';
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

  describe('fetchCommits', () => {
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

      const commits = await fetchCommits('owner', 'repo', { fetchImpl: mockFetch });

      expect(commits).toHaveLength(2);
      expect(commits[0].sha).toBe('sha1');
      expect(commits[0].author).toBe('alice');
      expect(commits[1].sha).toBe('sha2');
      expect(commits[1].author).toBe('bob');
    });

    it('should use author name when login is missing', async () => {
      const mockCommits = [
        createMockGitHubCommit('sha1', 'Alice Johnson', '2024-01-15T14:00:00Z'),
      ];

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockCommits,
      });

      const commits = await fetchCommits('owner', 'repo', { fetchImpl: mockFetch });

      expect(commits[0].author).toBe('Alice Johnson');
      expect(commits[0].authorLogin).toBeUndefined();
    });

    it('should exclude bots by default', async () => {
      const mockCommits = [
        createMockGitHubCommit('sha1', 'Alice', '2024-01-15T14:00:00Z', 'alice'),
        createMockGitHubCommit('sha2', 'dependabot', '2024-01-15T15:00:00Z', 'dependabot[bot]'),
        createMockGitHubCommit('sha3', 'Bob', '2024-01-15T16:00:00Z', 'bob'),
      ];

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockCommits,
      });

      const commits = await fetchCommits('owner', 'repo', { fetchImpl: mockFetch });

      expect(commits).toHaveLength(2);
      expect(commits.find((c) => c.author === 'dependabot')).toBeUndefined();
    });

    it('should include bots when excludeBots is false', async () => {
      const mockCommits = [
        createMockGitHubCommit('sha1', 'Alice', '2024-01-15T14:00:00Z', 'alice'),
        createMockGitHubCommit('sha2', 'dependabot', '2024-01-15T15:00:00Z', 'dependabot[bot]'),
      ];

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockCommits,
      });

      const commits = await fetchCommits('owner', 'repo', {
        fetchImpl: mockFetch,
        excludeBots: false,
      });

      expect(commits).toHaveLength(2);
      expect(commits.find((c) => c.author === 'dependabot[bot]')).toBeDefined();
    });

    it('should exclude merge commits when excludeMergeCommits is true', async () => {
      const mockCommits = [
        createMockGitHubCommit('sha1', 'Alice', '2024-01-15T14:00:00Z', 'alice', false),
        createMockGitHubCommit('sha2', 'Alice', '2024-01-15T15:00:00Z', 'alice', true),
        createMockGitHubCommit('sha3', 'Bob', '2024-01-15T16:00:00Z', 'bob', false),
      ];

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockCommits,
      });

      const commits = await fetchCommits('owner', 'repo', {
        fetchImpl: mockFetch,
        excludeMergeCommits: true,
      });

      expect(commits).toHaveLength(2);
      expect(commits.find((c) => c.sha === 'sha2')).toBeUndefined();
    });

    it('should filter by author list', async () => {
      const mockCommits = [
        createMockGitHubCommit('sha1', 'Alice', '2024-01-15T14:00:00Z', 'alice'),
        createMockGitHubCommit('sha2', 'Bob', '2024-01-15T15:00:00Z', 'bob'),
        createMockGitHubCommit('sha3', 'Charlie', '2024-01-15T16:00:00Z', 'charlie'),
      ];

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockCommits,
      });

      const commits = await fetchCommits('owner', 'repo', {
        fetchImpl: mockFetch,
        authors: ['alice', 'charlie'],
      });

      expect(commits).toHaveLength(2);
      expect(commits.find((c) => c.author === 'alice')).toBeDefined();
      expect(commits.find((c) => c.author === 'charlie')).toBeDefined();
      expect(commits.find((c) => c.author === 'bob')).toBeUndefined();
    });

    it('should match authors case-insensitively', async () => {
      const mockCommits = [
        createMockGitHubCommit('sha1', 'Alice Johnson', '2024-01-15T14:00:00Z', 'alice'),
      ];

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockCommits,
      });

      const commits = await fetchCommits('owner', 'repo', {
        fetchImpl: mockFetch,
        authors: ['ALICE'], // Uppercase
      });

      expect(commits).toHaveLength(1);
    });

    it('should add Authorization header when token is provided', async () => {
      const mockCommits = [
        createMockGitHubCommit('sha1', 'Alice', '2024-01-15T14:00:00Z', 'alice'),
      ];

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockCommits,
      });

      await fetchCommits('owner', 'repo', {
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

      await fetchCommits('owner', 'repo', {
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

      await fetchCommits('owner', 'repo', {
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

      const commits = await fetchCommits('owner', 'repo', { fetchImpl: mockFetch });

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

      const commits = await fetchCommits('owner', 'repo', {
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

      await expect(fetchCommits('owner', 'repo', { fetchImpl: mockFetch })).rejects.toThrow(
        StatsError
      );

      try {
        await fetchCommits('owner', 'repo', { fetchImpl: mockFetch });
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

      await expect(fetchCommits('owner', 'repo', { fetchImpl: mockFetch })).rejects.toThrow(
        StatsError
      );

      try {
        await fetchCommits('owner', 'repo', { fetchImpl: mockFetch });
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

      await expect(fetchCommits('owner', 'repo', { fetchImpl: mockFetch })).rejects.toThrow(
        StatsError
      );

      try {
        await fetchCommits('owner', 'repo', { fetchImpl: mockFetch });
      } catch (error) {
        expect((error as StatsError).code).toBe('RATE_LIMIT');
      }
    });

    it('should throw NETWORK error for fetch failures', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(fetchCommits('owner', 'repo', { fetchImpl: mockFetch })).rejects.toThrow(
        StatsError
      );

      try {
        await fetchCommits('owner', 'repo', { fetchImpl: mockFetch });
      } catch (error) {
        expect((error as StatsError).code).toBe('NETWORK');
      }
    });

    it('should handle empty response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const commits = await fetchCommits('owner', 'repo', { fetchImpl: mockFetch });

      expect(commits).toHaveLength(0);
    });
  });
});
