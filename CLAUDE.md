# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**vibe-coding-stats** is a TypeScript library and npm package for analyzing GitHub repositories to estimate developer activity in a human-friendly way. It calculates metrics like hours spent coding, coding sessions, and coffee cups consumed based on commit history.

The project consists of:
- **Core library** (`packages/core/`) - TypeScript package published to npm
- **Demo app** (`demo/`) - React + Vite app deployed to GitHub Pages for visualizing stats

## Architecture

### Session Detection Algorithm

The core concept is a **coding session**: a series of commits by the same author where consecutive commits are no more than `sessionTimeoutMin` minutes apart (default: 45 minutes).

Session duration calculation:
```
duration = (lastCommitTime - firstCommitTime) + firstCommitBonusMin
```

For single-commit sessions: `duration = firstCommitBonusMin` (default: 15 minutes)

### Data Flow

1. **Parse input** - Accept `repo: "owner/repo"` or `url: "https://github.com/..."`
2. **Fetch commits** - Use GitHub REST API (`/repos/:owner/:repo/commits`) with pagination
3. **Filter** - Remove bots (if `excludeBots: true`), apply author filters, time ranges
4. **Normalize** - Convert all timestamps to specified timezone
5. **Group** - Organize commits by author, sort chronologically
6. **Build sessions** - Apply timeout-based session detection
7. **Aggregate** - Calculate per-author, per-day, and total metrics
8. **Return** - Structured `RepoStats` object

### Key Types

- **`RepoStats`** - Main output with totals, perAuthor, perDay breakdowns
- **`AuthorStats`** - Per-author metrics (hours, sessions, commits, coffee)
- **`DayStats`** - Per-day metrics with list of active authors
- **`StatsOptions`** - Configuration (timeouts, date ranges, filters, caching)

### Package Structure

```
packages/core/
  src/
    api/github.ts          # GitHub API client (REST, with future GraphQL support)
    logic/sessions.ts      # Session grouping and duration calculation
    logic/aggregate.ts     # Aggregation by author/day, metrics computation
    model/types.ts         # TypeScript interfaces and types
    util/time.ts           # Timezone handling using date-fns
    index.ts               # Public API exports
  tests/                   # Vitest unit and integration tests
```

## Important Implementation Notes

### Cross-Midnight Sessions

Sessions can span across midnight and should be treated as a single continuous session. For example, commits from 11pm to 1am should be grouped into one session if they're within the `sessionTimeoutMin` threshold.

**Implementation note**: When aggregating to per-day metrics, assign the session to the day it started (based on the first commit's timestamp in the configured timezone).

### Merge Commits

The `excludeMergeCommits` option allows filtering merge commits, which often have different authorship semantics. Default is `false` (include merge commits).

### Bot Detection

When `excludeBots: true` (default), filter out common bot patterns like:
- dependabot
- renovate
- github-actions
- And other common automation tools

### Caching Strategy

- Default: `cache: 'memory'` with `cacheTTLms: 900000` (15 minutes)
- Cache key should include repo, date range, and filter options
- Useful for demo app to avoid re-fetching during option tweaks

### Error Handling

Use the `StatsError` class with structured error codes:
- `INVALID_REPO` - Malformed repo input
- `NOT_FOUND` - Repository doesn't exist (404)
- `RATE_LIMIT` - GitHub API rate limit exceeded
- `NETWORK` - Network/fetch errors
- `UNAUTHORIZED` - Invalid/missing GitHub token (401/403)
- `UNSUPPORTED_PRIVATE_REPO` - Private repos not supported
- `UNKNOWN` - Unexpected errors

## Development Commands

**Note**: This project is currently in specification phase. Once initialized, typical commands will be:

```bash
# Install dependencies (monorepo)
npm install

# Build core library
npm run build -w packages/core

# Run tests
npm test -w packages/core

# Run single test file
npm test -w packages/core -- sessions.test.ts

# Watch mode for tests
npm test -w packages/core -- --watch

# Lint
npm run lint

# Type check
npm run type-check

# Run demo locally
npm run dev -w demo

# Build demo for deployment
npm run build -w demo
```

## Testing Requirements

### Critical Test Cases

**Session Grouping**:
- Single commit sessions (should get `firstCommitBonusMin` duration)
- Multi-commit sessions with various gaps
- Boundary conditions (44min, 45min, 46min gaps)
- Multiple sessions from same author in one day
- Interleaved commits from different authors

**Timezone Handling**:
- UTC conversion accuracy
- Daylight saving time transitions
- Cross-timezone boundary edge cases

**Edge Cases**:
- Empty repository (0 commits) - should return zero metrics
- Single commit repository
- All commits filtered out (e.g., all bots)
- Invalid date ranges
- Future dates in `until` parameter

**GitHub API**:
- Mock pagination responses
- Rate limit scenarios (include retry logic)
- Error responses (404, 401, 403)

## Metrics Definitions

- **totalHours**: Sum of all session durations
- **sessionsCount**: Number of distinct coding sessions
- **devDays**: Number of calendar days with at least one commit
- **totalCommits**: Total commit count after filtering
- **avgCommitsPerSession**: totalCommits / sessionsCount
- **avgSessionsPerDay**: sessionsCount / devDays
- **coffeeCups**: sessionsCount (one cup per session ☕)

## Known Limitations

These are inherent to the approach and should be documented but not "fixed":

1. Only captures **committed work** - no WIP, stashes, or uncommitted changes
2. **Rebases/force-pushes** can alter history and affect accuracy
3. No measurement of **non-coding activities** (reviews, meetings, debugging without commits)
4. **Heuristic-based** session detection may occasionally split or merge incorrectly
5. **Author identification** depends on Git config consistency across machines

## Future Roadmap

- **v0.2**: Enhanced caching, progress UI, better visualizations
- **v0.3**: GraphQL support, file-level statistics
