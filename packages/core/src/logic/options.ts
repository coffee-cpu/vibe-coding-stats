import type { StatsOptions } from '../model/types.js';
import { StatsError } from '../model/types.js';
import { isValidTimezone, toDate } from '../util/time.js';

export const DEFAULT_SESSION_TIMEOUT_MIN = 45;
export const DEFAULT_FIRST_COMMIT_BONUS_MIN = 15;
export const DEFAULT_TIMEZONE = 'UTC';

export interface ResolvedSessionOptions {
  sessionTimeoutMin: number;
  firstCommitBonusMin: number;
  timezone: string;
}

function invalid(message: string): never {
  throw new StatsError('INVALID_OPTIONS', message);
}

function checkPositiveInteger(name: string, value: number | undefined): void {
  if (value !== undefined && !(Number.isInteger(value) && value > 0)) {
    invalid(`${name} must be a positive integer, got ${String(value)}`);
  }
}

function checkNonNegativeInteger(name: string, value: number | undefined): void {
  if (value !== undefined && !(Number.isInteger(value) && value >= 0)) {
    invalid(`${name} must be a non-negative integer, got ${String(value)}`);
  }
}

function checkDate(name: string, value: string | Date | undefined): Date | undefined {
  if (!value) return undefined; // empty values mean "no bound", as in the API layer
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) {
    invalid(`${name} is not a valid date: ${String(value)}`);
  }
  return date;
}

/**
 * Validate options and apply defaults for session building.
 * Throws StatsError('INVALID_OPTIONS') on bad input.
 */
export function resolveOptions(options: StatsOptions): ResolvedSessionOptions {
  const sessionTimeoutMin = options.sessionTimeoutMin ?? DEFAULT_SESSION_TIMEOUT_MIN;
  const firstCommitBonusMin = options.firstCommitBonusMin ?? DEFAULT_FIRST_COMMIT_BONUS_MIN;
  const timezone = options.timezone ?? DEFAULT_TIMEZONE;

  if (!Number.isFinite(sessionTimeoutMin) || sessionTimeoutMin <= 0) {
    invalid(`sessionTimeoutMin must be a positive number, got ${String(sessionTimeoutMin)}`);
  }
  if (!Number.isFinite(firstCommitBonusMin) || firstCommitBonusMin < 0) {
    invalid(`firstCommitBonusMin must be a non-negative number, got ${String(firstCommitBonusMin)}`);
  }
  if (!isValidTimezone(timezone)) {
    invalid(`Unknown timezone: ${timezone}`);
  }

  checkPositiveInteger('perPage', options.perPage);
  checkPositiveInteger('maxPages', options.maxPages);
  checkNonNegativeInteger('maxRetries', options.maxRetries);
  if (options.retryBaseDelayMs !== undefined && !(options.retryBaseDelayMs >= 0)) {
    invalid(`retryBaseDelayMs must be a non-negative number, got ${String(options.retryBaseDelayMs)}`);
  }
  if (options.cacheTTLms !== undefined && !(options.cacheTTLms >= 0)) {
    invalid(`cacheTTLms must be a non-negative number, got ${String(options.cacheTTLms)}`);
  }

  const since = checkDate('since', options.since);
  const until = checkDate('until', options.until);
  if (since && until && since.getTime() > until.getTime()) {
    invalid('since must not be later than until');
  }

  return { sessionTimeoutMin, firstCommitBonusMin, timezone };
}
