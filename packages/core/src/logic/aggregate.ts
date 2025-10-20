import type { Session, AuthorStats, DayStats } from '../model/types.js';

/**
 * Aggregate sessions into per-author statistics
 */
export function aggregateByAuthor(sessions: Session[]): AuthorStats[] {
  const authorMap = new Map<string, AuthorStats>();

  for (const session of sessions) {
    const existing = authorMap.get(session.author);

    if (existing) {
      existing.totalHours += session.durationMinutes / 60;
      existing.sessionsCount += 1;
      existing.totalCommits += session.commits.length;
      existing.coffeeCups += 1;
    } else {
      authorMap.set(session.author, {
        author: session.author,
        totalHours: session.durationMinutes / 60,
        sessionsCount: 1,
        totalCommits: session.commits.length,
        coffeeCups: 1,
      });
    }
  }

  return Array.from(authorMap.values()).sort((a, b) => b.totalHours - a.totalHours);
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
export function calculateTotals(sessions: Session[]) {
  const totalHours = sessions.reduce((sum, s) => sum + s.durationMinutes / 60, 0);
  const sessionsCount = sessions.length;
  const totalCommits = sessions.reduce((sum, s) => sum + s.commits.length, 0);

  // Get unique days
  const uniqueDays = new Set(sessions.map((s) => s.date));
  const devDays = uniqueDays.size;

  const avgCommitsPerSession = sessionsCount > 0 ? totalCommits / sessionsCount : 0;
  const avgSessionsPerDay = devDays > 0 ? sessionsCount / devDays : 0;
  const coffeeCups = sessionsCount;

  return {
    totalHours: Math.round(totalHours * 100) / 100,
    sessionsCount,
    devDays,
    totalCommits,
    avgCommitsPerSession: Math.round(avgCommitsPerSession * 100) / 100,
    avgSessionsPerDay: Math.round(avgSessionsPerDay * 100) / 100,
    coffeeCups,
  };
}
