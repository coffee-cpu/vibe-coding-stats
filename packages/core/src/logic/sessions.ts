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

  // Group commits by author, tracking authorLogin
  const commitsByAuthor = new Map<string, { commits: Commit[]; authorLogin?: string }>();
  for (const commit of commits) {
    const existing = commitsByAuthor.get(commit.author) || { commits: [], authorLogin: commit.authorLogin };
    existing.commits.push(commit);
    // Use authorLogin from first commit with one (they should all be the same for a given author)
    if (!existing.authorLogin && commit.authorLogin) {
      existing.authorLogin = commit.authorLogin;
    }
    commitsByAuthor.set(commit.author, existing);
  }

  const sessions: Session[] = [];

  // Process each author's commits
  for (const [author, { commits: authorCommits, authorLogin }] of commitsByAuthor) {
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
          sessions.push(createSession(currentSession, author, authorLogin, firstCommitBonusMin, timezone));
          currentSession = [commit];
        }
      }
    }

    // Don't forget the last session
    if (currentSession.length > 0) {
      sessions.push(createSession(currentSession, author, authorLogin, firstCommitBonusMin, timezone));
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
  authorLogin: string | undefined,
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

  // Calculate commit gap metrics (only for multi-commit sessions)
  let avgMinutesBetweenCommits: number | undefined;
  let maxMinutesBetweenCommits: number | undefined;

  if (commits.length > 1) {
    const gaps: number[] = [];
    for (let i = 1; i < commits.length; i++) {
      const gap = diffInMinutes(commits[i].date, commits[i - 1].date);
      gaps.push(gap);
    }

    const totalGap = gaps.reduce((sum, gap) => sum + gap, 0);
    avgMinutesBetweenCommits = Math.round((totalGap / gaps.length) * 100) / 100;
    maxMinutesBetweenCommits = Math.round(Math.max(...gaps) * 100) / 100;
  }

  return {
    author,
    authorLogin,
    commits,
    startTime,
    endTime,
    durationMinutes,
    date,
    avgMinutesBetweenCommits,
    maxMinutesBetweenCommits,
  };
}
