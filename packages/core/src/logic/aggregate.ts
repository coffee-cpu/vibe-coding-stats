import type { Session, AuthorStats, DayStats, AggregateStats } from '../model/types.js';
import { groupBy, round2 } from '../util/collections.js';
import { dayOfWeekOfISODate } from '../util/time.js';

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Calculate aggregate statistics from a set of sessions
 * Used for both totals and per-author stats
 */
export function calculateAggregateStats(sessions: Session[]): AggregateStats {
  let totalMinutes = 0;
  let totalCommits = 0;
  let longestSessionMinutes = 0;
  let totalGapMinutes = 0;
  let gapCount = 0;
  let maxGapMinutes: number | undefined;

  for (const session of sessions) {
    totalMinutes += session.durationMinutes;
    totalCommits += session.commits.length;
    longestSessionMinutes = Math.max(longestSessionMinutes, session.durationMinutes);

    if (session.commits.length > 1) {
      // Gaps within a sorted session sum to its span, so this is exact
      totalGapMinutes += (session.endTime.getTime() - session.startTime.getTime()) / MS_PER_MINUTE;
      gapCount += session.commits.length - 1;
      maxGapMinutes = Math.max(maxGapMinutes ?? 0, session.maxMinutesBetweenCommits ?? 0);
    }
  }

  const totalHours = totalMinutes / 60;
  const sessionsCount = sessions.length;
  const devDays = new Set(sessions.map((s) => s.date)).size;

  return {
    totalHours: round2(totalHours),
    sessionsCount,
    devDays,
    totalCommits,
    avgCommitsPerSession: sessionsCount > 0 ? round2(totalCommits / sessionsCount) : 0,
    avgSessionsPerDay: devDays > 0 ? round2(sessionsCount / devDays) : 0,
    longestSessionHours: round2(longestSessionMinutes / 60),
    avgSessionHours: sessionsCount > 0 ? round2(totalHours / sessionsCount) : 0,
    mostProductiveDayOfWeek: calculateMostProductiveDayOfWeek(sessions),
    longestStreakDays: calculateLongestStreakDays(sessions),
    minTimeBetweenSessionsMin: calculateMinTimeBetweenSessions(sessions),
    avgMinutesBetweenCommits: gapCount > 0 ? round2(totalGapMinutes / gapCount) : undefined,
    maxMinutesBetweenCommits: maxGapMinutes !== undefined ? round2(maxGapMinutes) : undefined,
  };
}

/**
 * Aggregate sessions into per-author statistics, sorted by total hours (descending)
 */
export function aggregateByAuthor(sessions: Session[]): AuthorStats[] {
  return Array.from(groupBy(sessions, (s) => s.author))
    .map(([author, authorSessions]) => ({
      author,
      authorLogin: authorSessions.find((s) => s.authorLogin)?.authorLogin,
      ...calculateAggregateStats(authorSessions),
    }))
    .sort((a, b) => b.totalHours - a.totalHours);
}

/**
 * Aggregate sessions into per-day statistics, sorted by date (ascending)
 */
export function aggregateByDay(sessions: Session[]): DayStats[] {
  return Array.from(groupBy(sessions, (s) => s.date))
    .map(([date, daySessions]) => ({
      date,
      totalHours: round2(daySessions.reduce((sum, s) => sum + s.durationMinutes, 0) / 60),
      sessionsCount: daySessions.length,
      totalCommits: daySessions.reduce((sum, s) => sum + s.commits.length, 0),
      authors: Array.from(new Set(daySessions.map((s) => s.author))),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Calculate the most productive day of week based on total hours.
 * Uses the session's date, which is already in the configured timezone.
 */
function calculateMostProductiveDayOfWeek(sessions: Session[]): string | undefined {
  if (sessions.length === 0) return undefined;

  const minutesByDay = new Array<number>(7).fill(0);
  for (const session of sessions) {
    minutesByDay[dayOfWeekOfISODate(session.date)] += session.durationMinutes;
  }

  let maxDay = 0;
  for (let day = 1; day < 7; day++) {
    if (minutesByDay[day] > minutesByDay[maxDay]) maxDay = day;
  }
  return DAY_NAMES[maxDay];
}

/**
 * Calculate the longest streak of consecutive days on which a session started
 */
function calculateLongestStreakDays(sessions: Session[]): number {
  const dates = Array.from(new Set(sessions.map((s) => s.date))).sort();
  if (dates.length === 0) return 0;

  let currentStreak = 1;
  let longestStreak = 1;

  for (let i = 1; i < dates.length; i++) {
    // YYYY-MM-DD strings parse as UTC midnight, so the difference is a whole number of days
    const diffDays = Math.round((Date.parse(dates[i]) - Date.parse(dates[i - 1])) / MS_PER_DAY);
    currentStreak = diffDays === 1 ? currentStreak + 1 : 1;
    longestStreak = Math.max(longestStreak, currentStreak);
  }

  return longestStreak;
}

/**
 * Calculate the minimum time between consecutive sessions by the same author
 * Returns undefined if no author has 2 or more sessions
 */
function calculateMinTimeBetweenSessions(sessions: Session[]): number | undefined {
  let minGapMinutes = Infinity;

  for (const authorSessions of groupBy(sessions, (s) => s.author).values()) {
    if (authorSessions.length < 2) continue;

    const sorted = [...authorSessions].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );
    for (let i = 1; i < sorted.length; i++) {
      const gapMinutes =
        (sorted[i].startTime.getTime() - sorted[i - 1].endTime.getTime()) / MS_PER_MINUTE;
      if (gapMinutes > 0) {
        minGapMinutes = Math.min(minGapMinutes, gapMinutes);
      }
    }
  }

  return minGapMinutes === Infinity ? undefined : round2(minGapMinutes);
}
