# vibe-coding-stats — Specification

## Overview

**vibe-coding-stats** is a TypeScript library and npm package for analyzing GitHub repositories to estimate developer activity in a more "human" way — including hours spent coding, coding sessions, coffee cups consumed, and more.

The library can also power a web demo (hosted on GitHub Pages) that visualizes this data for any public GitHub repository.

---

## Goals

- **Language:** TypeScript  
- **Distribution:** npm  
- **Demo:** React + Vite app on GitHub Pages  
- **Purpose:** Provide lightweight, fun, approximate coding metrics for any public repo  

### Core Metrics

- `totalHours`: approximate total coding hours  
- `sessionsCount`: number of coding sessions  
- `devDays`: number of days with at least one commit  
- `totalCommits`: total commits  
- `avgCommitsPerSession`: average commits per session  
- `avgSessionsPerDay`: average sessions per development day  
- `coffeeCups`: one cup of coffee per session ☕  

---

## Definition of a "Session"

A **coding session** is defined as a series of commits by the **same author** where the time gap between consecutive commits does not exceed `sessionTimeoutMin` minutes.  
Each session’s duration is:

```
duration = (lastCommitTime - firstCommitTime) + firstCommitBonusMin
```

If there is only one commit, duration = `firstCommitBonusMin`.

Default configuration:
```ts
sessionTimeoutMin = 45
firstCommitBonusMin = 15
```

---

## Package API

### Installation

```bash
npm i vibe-coding-stats
```

### Basic usage

```ts
import { getRepoStats } from 'vibe-coding-stats';

const stats = await getRepoStats({
  repo: 'coffee-cpu/capital-gains-uk-101',
});

console.log(stats);
```

### Input Types

```ts
export type RepoInput =
  | { repo: string }              // "owner/repo"
  | { url: string };              // e.g. https://github.com/owner/repo(.git)

export interface StatsOptions {
  sessionTimeoutMin?: number;     // default: 45
  firstCommitBonusMin?: number;   // default: 15
  since?: string | Date;
  until?: string | Date;
  authors?: string[];
  excludeBots?: boolean;          // default: true
  excludeMergeCommits?: boolean;  // default: false
  timezone?: string;              // default: "UTC"
  githubToken?: string;           // optional for higher rate limit
  fetchImpl?: typeof fetch;
  perPage?: number;               // default: 100
  maxPages?: number;
  useGraphQL?: boolean;           // default: false
  cache?: 'memory' | 'none';      // default: 'memory'
  cacheTTLms?: number;            // default: 15 min
}
```

### Output

```ts
export interface RepoStats {
  repo: string;
  period: { since?: string; until?: string };
  config: {
    sessionTimeoutMin: number;
    firstCommitBonusMin: number;
    timezone: string;
  };
  totals: {
    totalHours: number;
    sessionsCount: number;
    devDays: number;
    totalCommits: number;
    avgCommitsPerSession: number;
    avgSessionsPerDay: number;
    coffeeCups: number;
  };
  perAuthor: AuthorStats[];
  perDay: DayStats[];
  raw?: {
    commitSample?: Array<{
      sha: string;
      authorLogin?: string;
      authorName?: string;
      date: string;
    }>;
  };
}

export interface AuthorStats {
  author: string;
  totalHours: number;
  sessionsCount: number;
  totalCommits: number;
  coffeeCups: number;
}

export interface DayStats {
  date: string;              // ISO date string (YYYY-MM-DD)
  totalHours: number;
  sessionsCount: number;
  totalCommits: number;
  authors: string[];
}
```

---

## Algorithm Summary

1. Parse input (`repo` or `url`)
2. Fetch commits from GitHub REST API (`/repos/:owner/:repo/commits`)
3. Filter commits (exclude bots, filter by authors, time range)
4. Normalize timestamps to timezone
5. Group by author → sort by time
6. Build sessions (time gap ≤ `sessionTimeoutMin`)
7. Compute durations and aggregate by author/day
8. Compute total and average metrics
9. Return structured `RepoStats`

---

## Common Use Cases

```ts
// Personal coding stats for 2024
const myStats = await getRepoStats({
  repo: 'username/my-project',
  since: '2024-01-01',
  until: '2024-12-31',
  authors: ['my-github-username'],
});

// Team activity comparison
const teamStats = await getRepoStats({
  url: 'https://github.com/coffee-cpu/vibe-coding-stats',
  since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // last 30 days
  timezone: 'America/New_York',
});

// Open source project analysis
const ossStats = await getRepoStats({
  repo: 'coffee-cpu/vibe-coding-stats',
  excludeBots: true,
  sessionTimeoutMin: 60, // longer timeout for OSS
});

// With GitHub token for higher rate limits
const stats = await getRepoStats({
  repo: 'owner/repo',
  githubToken: process.env.GITHUB_TOKEN,
});
```

---

## Error Handling

```ts
export type StatsErrorCode =
  | 'INVALID_REPO'
  | 'NOT_FOUND'
  | 'RATE_LIMIT'
  | 'NETWORK'
  | 'UNAUTHORIZED'
  | 'UNSUPPORTED_PRIVATE_REPO'
  | 'UNKNOWN';
```

Custom `StatsError` class provides human-readable messages and structured codes.

---

## Limitations

This library provides **approximate** coding activity metrics based on commit history. Users should be aware of the following limitations:

- **Only committed work is counted** - Work in progress, uncommitted changes, and experimental branches are not captured
- **Rebases and force-pushes may affect accuracy** - Git history rewriting can alter timestamps and commit counts
- **Doesn't capture non-coding time** - Code review, meetings, debugging, research, and thinking time are not measured
- **Session detection is heuristic** - The timeout-based approach may split or merge sessions incorrectly depending on commit patterns
- **Author identification** - Based on Git author info, which can be inconsistent across different machines or configurations
- **No file-level granularity** - All commits are weighted equally regardless of lines changed (planned for v0.3)

---

## Dependencies and Tools

- **Language:** TypeScript (target ES2020)
- **Bundler:** tsup
- **Testing:** vitest
- **Date handling:** `date-fns` (for timezone conversion and date manipulation)
- **Fetch:** global fetch (Node 18+)
- **Lint/Format:** eslint + prettier

---

## Demo App (GitHub Pages)

### Features

- Input: GitHub repo URL or "owner/repo"
- Configurable options (session timeout, bonus, date range, timezone)
- Optional GitHub token for higher rate limits
- Displays:
  - Summary cards (hours, sessions, commits, coffee)
  - Charts/tables per day and per author
  - Error and rate-limit handling
- Progress bar while loading pages of commits

### Stack

- React + Vite + TypeScript
- No backend (runs entirely in browser)
- Deployed via GitHub Actions to `gh-pages`

---

## Testing Strategy

Core functionality will be tested using **vitest** with the following test coverage:

### Unit Tests

- **Session grouping logic**
  - Single commit sessions
  - Multi-commit sessions with various time gaps
  - Sessions at session timeout boundary (44min, 45min, 46min)
  - Multiple sessions from same author in one day
  - Interleaved commits from different authors

- **Time and timezone handling**
  - UTC conversions
  - Different timezone offsets
  - Daylight saving time transitions
  - Cross-midnight sessions (sessions spanning midnight should remain one session)

- **Bot filtering**
  - Common bot patterns (dependabot, renovate, etc.)
  - Custom author filtering

- **Aggregation calculations**
  - Per-author totals
  - Per-day totals
  - Average calculations with edge cases (zero commits, single session)

### Integration Tests

- **GitHub API interactions**
  - Successful fetch with pagination
  - Error scenarios (404, 401, rate limits)
  - Empty repositories
  - Repositories with single commit
  - Mock API responses

### Edge Cases

- Empty repository (0 commits)
- Repository with 1 commit
- All commits filtered out (e.g., all from bots)
- Invalid date ranges
- Future dates in `until`

---

## Folder Structure

```
vibe-coding-stats/
  packages/
    core/
      src/
        api/github.ts
        logic/sessions.ts
        logic/aggregate.ts
        model/types.ts
        util/time.ts
        index.ts
      tests/
      package.json
  demo/
    src/
      App.tsx
      components/
      main.tsx
    vite.config.ts
    index.html
```

---

## Future Versions

**v0.1** — Core metrics + cross-midnight sessions + GitHub Pages demo
**v0.2** — Caching, progress UI, better charts
**v0.3** — Support GraphQL, file-level stats  

---

## License

MIT
