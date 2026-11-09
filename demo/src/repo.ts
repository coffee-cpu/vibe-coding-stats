import { parseRepoInput, type RepoInput } from 'vibe-coding-stats';

/**
 * Turn what the user typed ("owner/repo" or any GitHub URL) into library input.
 */
export function toRepoInput(value: string): RepoInput {
  const trimmed = value.trim();
  const isUrl = /github\.com/i.test(trimmed) || /^[a-z]+:\/\//i.test(trimmed);
  return isUrl ? { url: trimmed } : { repo: trimmed };
}

/**
 * Normalize user input to "owner/repo", or return it unchanged if it cannot be parsed.
 */
export function normalizeRepo(value: string): string {
  try {
    const { owner, repo } = parseRepoInput(toRepoInput(value));
    return `${owner}/${repo}`;
  } catch {
    return value.trim();
  }
}
