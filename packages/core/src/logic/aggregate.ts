import type { Session, AuthorStats, DayStats, AggregateStats } from '../model/types.js';

/**
 * Calculate aggregate statistics from a set of sessions
 * This shared function is used for both totals and per-author stats
 */
export function calculateAggregateStats(sessions: Session[]): AggregateStats {
  const totalHours = sessions.reduce((sum, s) => sum + s.durationMinutes / 60, 0);
  const sessionsCount = sessions.length;
  const totalCommits = sessions.reduce((sum, s) => sum + s.commits.length, 0);

  // Get unique days
  const uniqueDays = new Set(sessions.map((s) => s.date));
  const devDays = uniqueDays.size;

  // Find longest session
  const longestSessionHours = sessions.length > 0
    ? Math.max(...sessions.map((s) => s.durationMinutes / 60))
    : 0;

  const avgCommitsPerSession = sessionsCount > 0 ? totalCommits / sessionsCount : 0;
  const avgSessionsPerDay = devDays > 0 ? sessionsCount / devDays : 0;
  const avgSessionHours = sessionsCount > 0 ? totalHours / sessionsCount : 0;

  // Calculate most productive day of week
  const mostProductiveDayOfWeek = calculateMostProductiveDayOfWeek(sessions);

  // Calculate longest streak
  const longestStreakDays = calculateLongestStreakDays(sessions);

  // Calculate minimum time between sessions
  const minTimeBetweenSessionsMin = calculateMinTimeBetweenSessions(sessions);

  // Calculate commit gap metrics across all sessions
  const allCommitGaps: number[] = [];
  let maxCommitGap = 0;

  for (const session of sessions) {
    if (session.avgMinutesBetweenCommits !== undefined) {
      const numGaps = session.commits.length - 1;
      allCommitGaps.push(...Array(numGaps).fill(session.avgMinutesBetweenCommits));
    }
    if (session.maxMinutesBetweenCommits !== undefined) {
      maxCommitGap = Math.max(maxCommitGap, session.maxMinutesBetweenCommits);
    }
  }

  const avgMinutesBetweenCommits = allCommitGaps.length > 0
    ? Math.round((allCommitGaps.reduce((sum, gap) => sum + gap, 0) / allCommitGaps.length) * 100) / 100
    : undefined;

  const maxMinutesBetweenCommits = maxCommitGap > 0
    ? Math.round(maxCommitGap * 100) / 100
    : undefined;

  return {
    totalHours: Math.round(totalHours * 100) / 100,
    sessionsCount,
    devDays,
    totalCommits,
    avgCommitsPerSession: Math.round(avgCommitsPerSession * 100) / 100,
    avgSessionsPerDay: Math.round(avgSessionsPerDay * 100) / 100,
    longestSessionHours: Math.round(longestSessionHours * 100) / 100,
    avgSessionHours: Math.round(avgSessionHours * 100) / 100,
    mostProductiveDayOfWeek,
    longestStreakDays,
    minTimeBetweenSessionsMin,
    avgMinutesBetweenCommits,
    maxMinutesBetweenCommits,
  };
}

/**
 * Aggregate sessions into per-author statistics
 */
export function aggregateByAuthor(sessions: Session[]): AuthorStats[] {
  // Group sessions by author, tracking authorLogin
  const sessionsByAuthor = new Map<string, { sessions: Session[]; authorLogin?: string }>();

  for (const session of sessions) {
    const existing = sessionsByAuthor.get(session.author) || { sessions: [], authorLogin: session.authorLogin };
    existing.sessions.push(session);
    // Use authorLogin from first session with one (they should all be the same for a given author)
    if (!existing.authorLogin && session.authorLogin) {
      existing.authorLogin = session.authorLogin;
    }
    sessionsByAuthor.set(session.author, existing);
  }

  // Calculate stats for each author using the shared function
  return Array.from(sessionsByAuthor.entries())
    .map(([author, { sessions: authorSessions, authorLogin }]) => ({
      author,
      authorLogin,
      ...calculateAggregateStats(authorSessions),
    }))
    .sort((a, b) => b.totalHours - a.totalHours);
}

/**
 * Aggregate sessions into per-day statistics
 */
export function aggregateByDay(sessions: Session[]): DayStats[] {
  const dayMap = new Map<string, DayStats>();

  for (const session of sessions) {
    const existing = dayMap.get(session.date);

    if (existing) {
      existing.totalHours += session.durationMinutes / 60;
      existing.sessionsCount += 1;
      existing.totalCommits += session.commits.length;
      if (!existing.authors.includes(session.author)) {
        existing.authors.push(session.author);
      }
    } else {
      dayMap.set(session.date, {
        date: session.date,
        totalHours: session.durationMinutes / 60,
        sessionsCount: 1,
        totalCommits: session.commits.length,
        authors: [session.author],
      });
    }
  }

  return Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Calculate total statistics from sessions
 */
export function calculateTotals(sessions: Session[]): AggregateStats {
  return calculateAggregateStats(sessions);
}

/**
 * Calculate the most productive day of week based on total hours
 */
function calculateMostProductiveDayOfWeek(sessions: Session[]): string | undefined {
  if (sessions.length === 0) return undefined;

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayHours = new Map<number, number>();

  for (const session of sessions) {
    const dayOfWeek = new Date(session.startTime).getDay();
    const hours = session.durationMinutes / 60;
    dayHours.set(dayOfWeek, (dayHours.get(dayOfWeek) || 0) + hours);
  }

  if (dayHours.size === 0) return undefined;

  // Find day with most hours
  let maxHours = 0;
  let maxDay = 0;
  for (const [day, hours] of dayHours.entries()) {
    if (hours > maxHours) {
      maxHours = hours;
      maxDay = day;
    }
  }

  return dayNames[maxDay];
}

/**
 * Calculate the longest streak of consecutive days with commits
 */
function calculateLongestStreakDays(sessions: Session[]): number {
  if (sessions.length === 0) return 0;

  // Get unique sorted dates
  const dates = Array.from(new Set(sessions.map((s) => s.date))).sort();

  if (dates.length === 0) return 0;

  let currentStreak = 1;
  let longestStreak = 1;

  for (let i = 1; i < dates.length; i++) {
    const prevDate = new Date(dates[i - 1]);
    const currDate = new Date(dates[i]);

    // Calculate difference in days
    const diffTime = currDate.getTime() - prevDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      // Consecutive day
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      // Streak broken
      currentStreak = 1;
    }
  }

  return longestStreak;
}

/**
 * Calculate the minimum time between consecutive sessions by the same author
 * Returns undefined if no author has 2 or more sessions
 */
function calculateMinTimeBetweenSessions(sessions: Session[]): number | undefined {
  if (sessions.length < 2) return undefined;

  // Group sessions by author
  const sessionsByAuthor = new Map<string, Session[]>();
  for (const session of sessions) {
    const existing = sessionsByAuthor.get(session.author) || [];
    existing.push(session);
    sessionsByAuthor.set(session.author, existing);
  }

  let minGapMinutes = Infinity;

  // For each author with 2+ sessions, find minimum gap between consecutive sessions
  for (const authorSessions of sessionsByAuthor.values()) {
    if (authorSessions.length < 2) continue;

    // Sort this author's sessions by end time
    const sortedSessions = [...authorSessions].sort((a, b) => a.endTime.getTime() - b.endTime.getTime());

    // Find gaps between consecutive sessions
    for (let i = 1; i < sortedSessions.length; i++) {
      const prevSessionEnd = sortedSessions[i - 1].endTime.getTime();
      const currentSessionStart = sortedSessions[i].startTime.getTime();

      const gapMinutes = (currentSessionStart - prevSessionEnd) / (1000 * 60);

      // Only consider positive gaps (non-overlapping sessions)
      if (gapMinutes > 0) {
        minGapMinutes = Math.min(minGapMinutes, gapMinutes);
      }
    }
  }

  // If minGapMinutes is still Infinity, no author had valid gaps between sessions
  if (minGapMinutes === Infinity) return undefined;

  return Math.round(minGapMinutes * 100) / 100;
}
