import type { Commit, Session } from '../model/types.js';
import { diffInMinutes, toISODate } from '../util/time.js';
import { groupBy, round2 } from '../util/collections.js';

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
  const sessions: Session[] = [];

  for (const [author, authorCommits] of groupBy(commits, (c) => c.author)) {
    const authorLogin = authorCommits.find((c) => c.authorLogin)?.authorLogin;
    const sortedCommits = [...authorCommits].sort((a, b) => a.date.getTime() - b.date.getTime());

    let currentSession: Commit[] = [];

    for (const commit of sortedCommits) {
      const lastCommit = currentSession[currentSession.length - 1];
      if (lastCommit && diffInMinutes(commit.date, lastCommit.date) > sessionTimeoutMin) {
        sessions.push(createSession(currentSession, author, authorLogin, firstCommitBonusMin, timezone));
        currentSession = [];
      }
      currentSession.push(commit);
    }

    if (currentSession.length > 0) {
      sessions.push(createSession(currentSession, author, authorLogin, firstCommitBonusMin, timezone));
    }
  }

  return sessions;
}

/**
 * Create a session from a list of commits (sorted oldest first)
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

  // Time from first to last commit plus the bonus (just the bonus for single commits)
  const durationMinutes = diffInMinutes(startTime, endTime) + firstCommitBonusMin;

  // Session date is the day it started (in configured timezone)
  const date = toISODate(startTime, timezone);

  // Commit gap metrics (only for multi-commit sessions)
  let avgMinutesBetweenCommits: number | undefined;
  let maxMinutesBetweenCommits: number | undefined;

  if (commits.length > 1) {
    let maxGap = 0;
    for (let i = 1; i < commits.length; i++) {
      maxGap = Math.max(maxGap, diffInMinutes(commits[i].date, commits[i - 1].date));
    }
    // The gaps of a sorted session sum to its span
    avgMinutesBetweenCommits = round2(diffInMinutes(startTime, endTime) / (commits.length - 1));
    maxMinutesBetweenCommits = round2(maxGap);
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
