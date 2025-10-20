import type { Commit, Session } from '../model/types.js';
import { diffInMinutes, toISODate } from '../util/time.js';

export interface SessionConfig {
  sessionTimeoutMin: number;
  firstCommitBonusMin: number;
  timezone: string;
}

/**
 * Group commits into sessions by author
 * A session is a series of commits by the same author where consecutive commits
 * are no more than sessionTimeoutMin minutes apart
 */
export function buildSessions(commits: Commit[], config: SessionConfig): Session[] {
  const { sessionTimeoutMin, firstCommitBonusMin, timezone } = config;

  // Group commits by author
  const commitsByAuthor = new Map<string, Commit[]>();
  for (const commit of commits) {
    const existing = commitsByAuthor.get(commit.author) || [];
    existing.push(commit);
    commitsByAuthor.set(commit.author, existing);
  }

  const sessions: Session[] = [];

  // Process each author's commits
  for (const [author, authorCommits] of commitsByAuthor) {
    // Sort commits by date (oldest first)
    const sortedCommits = authorCommits.sort((a, b) => a.date.getTime() - b.date.getTime());

    let currentSession: Commit[] = [];

    for (const commit of sortedCommits) {
      if (currentSession.length === 0) {
        // Start a new session
        currentSession.push(commit);
      } else {
        // Check time gap between current commit and last commit in session
        const lastCommit = currentSession[currentSession.length - 1];
        const gap = diffInMinutes(commit.date, lastCommit.date);

        if (gap <= sessionTimeoutMin) {
          // Continue current session
          currentSession.push(commit);
        } else {
          // End current session and start a new one
          sessions.push(createSession(currentSession, author, firstCommitBonusMin, timezone));
          currentSession = [commit];
        }
      }
    }

    // Don't forget the last session
    if (currentSession.length > 0) {
      sessions.push(createSession(currentSession, author, firstCommitBonusMin, timezone));
    }
  }

  return sessions;
}

/**
 * Create a session from a list of commits
 */
function createSession(
  commits: Commit[],
  author: string,
  firstCommitBonusMin: number,
  timezone: string
): Session {
  const startTime = commits[0].date;
  const endTime = commits[commits.length - 1].date;

  // Calculate duration
  let durationMinutes: number;
  if (commits.length === 1) {
    // Single commit: use bonus time
    durationMinutes = firstCommitBonusMin;
  } else {
    // Multiple commits: time from first to last + bonus
    durationMinutes = diffInMinutes(startTime, endTime) + firstCommitBonusMin;
  }

  // Session date is the day it started (in configured timezone)
  const date = toISODate(startTime, timezone);

  return {
    author,
    commits,
    startTime,
    endTime,
    durationMinutes,
    date,
  };
}
