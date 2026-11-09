import { describe, it, expect } from 'vitest';
import { resolveOptions } from '../src/logic/options.js';
import { StatsError } from '../src/model/types.js';

function expectInvalid(fn: () => unknown): void {
  try {
    fn();
    expect.unreachable('expected INVALID_OPTIONS');
  } catch (error) {
    expect(error).toBeInstanceOf(StatsError);
    expect((error as StatsError).code).toBe('INVALID_OPTIONS');
  }
}

describe('resolveOptions', () => {
  it('applies defaults', () => {
    expect(resolveOptions({})).toEqual({
      sessionTimeoutMin: 45,
      firstCommitBonusMin: 15,
      timezone: 'UTC',
    });
  });

  it('accepts valid options', () => {
    expect(
      resolveOptions({
        sessionTimeoutMin: 30,
        firstCommitBonusMin: 0,
        timezone: 'Europe/Berlin',
        since: '2024-01-01',
        until: new Date('2024-02-01T00:00:00Z'),
        perPage: 50,
        maxPages: 3,
        maxRetries: 0,
      })
    ).toEqual({ sessionTimeoutMin: 30, firstCommitBonusMin: 0, timezone: 'Europe/Berlin' });
  });

  it('treats empty date strings as no bound', () => {
    expect(() => resolveOptions({ since: '', until: '' })).not.toThrow();
  });

  it.each([
    [{ timezone: 'Mars/Base' }],
    [{ sessionTimeoutMin: 0 }],
    [{ sessionTimeoutMin: -5 }],
    [{ sessionTimeoutMin: Number.NaN }],
    [{ firstCommitBonusMin: -1 }],
    [{ firstCommitBonusMin: Number.POSITIVE_INFINITY }],
    [{ perPage: 0 }],
    [{ perPage: 1.5 }],
    [{ maxPages: -1 }],
    [{ maxRetries: -1 }],
    [{ retryBaseDelayMs: -1 }],
    [{ cacheTTLms: -1 }],
    [{ since: 'not a date' }],
    [{ until: new Date('invalid') }],
    [{ since: '2024-02-01', until: '2024-01-01' }],
  ])('rejects %j', (options) => {
    expectInvalid(() => resolveOptions(options));
  });
});
