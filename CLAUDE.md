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
    api/github.ts          # GitHub API client (pure HTTP, returns raw GitHub data)
    logic/
      filters.ts           # Filtering logic (bots, merge commits, authors)
      transform.ts         # Transform GitHub API format to internal types
      sessions.ts          # Session grouping and duration calculation
      aggregate.ts         # Aggregation by author/day, metrics computation
    model/types.ts         # TypeScript interfaces and types
    util/
      time.ts              # Timezone handling using date-fns
      cache.ts             # In-memory caching implementation
    index.ts               # Public API and orchestration layer
  tests/                   # Vitest unit and integration tests
```

### Architectural Principles

**Separation of Concerns**: Each module has a single, well-defined responsibility:

1. **API Layer** (`api/github.ts`)
   - Pure HTTP client - only communicates with GitHub REST API
   - Returns raw `GitHubCommit[]` data without any transformation
   - Handles pagination, authentication, and error mapping
   - Does NOT filter, transform, or orchestrate business logic

2. **Transformation Layer** (`logic/transform.ts`)
   - Converts GitHub API format to internal `Commit` type
   - Enriches data with metadata (isBot, isMerge flags)
   - Pure functions, easy to test in isolation

3. **Filtering Layer** (`logic/filters.ts`)
   - Centralized filtering logic for bots, merge commits, and author filtering
   - Exports reusable predicates: `isLikelyBot()`, `isMergeCommit()`, `shouldIncludeCommit()`
   - All filtering decisions in one place for easy maintenance

4. **Orchestration Layer** (`index.ts`)
   - Coordinates the data flow: **fetch → filter → transform → sessions → aggregation**
   - Only place where the full pipeline is assembled
   - Handles caching at the appropriate level

**Data Flow Pattern**:
```
GitHub API (raw)
  ↓ fetch (api/github.ts)
GitHubCommit[]
  ↓ filter (logic/filters.ts)
GitHubCommit[] (filtered)
  ↓ transform (logic/transform.ts)
Commit[]
  ↓ session building (logic/sessions.ts)
Session[]
  ↓ aggregation (logic/aggregate.ts)
RepoStats
```

This architecture makes it easy to:
- Test each layer independently
- Replace implementations (e.g., swap REST API for GraphQL)
- Add new filters or transformations without touching other layers
- Understand the data flow at a glance

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

## Technical Guidelines

### Code Organization

**Single Responsibility Principle**:
- Each module should have ONE clear purpose
- API layer handles HTTP only, no business logic
- Orchestration happens at application layer (index.ts), not in API or utility layers
- When a module does multiple things, split it into focused modules

**Naming Conventions**:
- API functions should indicate they return raw data: `fetchGitHubCommits()` not `fetchCommits()`
- Predicates should be clear: `isLikelyBot()`, `isMergeCommit()`, `shouldIncludeCommit()`
- Transformation functions: `transformGitHubCommit()` - verb + type pattern

**Testing Strategy**:
- Test each layer independently with mocked dependencies
- Integration tests should cover the full pipeline (see `integration.test.ts`)
- When refactoring, ensure all existing tests still pass
- Current test count: 96 tests across 6 test files

### Build Configuration

**TypeScript Compilation**:
- `tsconfig.json` uses `composite: true` for project references
- tsup DTS generation needs `composite: false` override in `tsup.config.ts`:
  ```typescript
  dts: {
    resolve: true,
    compilerOptions: {
      composite: false,  // Required for DTS build to work
    },
  }
  ```

### Common Patterns

**Error Handling**:
- Use `StatsError` class with semantic error codes
- API layer maps HTTP errors to error codes (404 → NOT_FOUND, etc.)
- Always wrap fetch errors in try/catch and rethrow as StatsError

**Data Transformation Pattern**:
```typescript
// ❌ Don't transform in API layer
export async function fetchData() {
  const raw = await api();
  return transform(filter(raw));  // NO!
}

// ✅ Return raw data, transform at orchestration layer
export async function fetchData() {
  return await api();  // Return raw data
}

// In index.ts:
const raw = await fetchData();
const filtered = raw.filter(predicate);
const transformed = filtered.map(transform);
```

**Filtering Pattern**:
- Use array methods with predicates: `.filter(shouldIncludeCommit)`
- Keep all filtering logic in `logic/filters.ts`
- Filtering happens BEFORE transformation to reduce processing

## Future Roadmap

- **v0.2**: Enhanced caching, progress UI, better visualizations
- **v0.3**: GraphQL support, file-level statistics
- always use https://github.com/coffee-cpu/vibe-coding-stats.git as a testing repo