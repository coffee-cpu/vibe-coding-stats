# vibe-coding-stats

[![npm version](https://img.shields.io/npm/v/vibe-coding-stats.svg)](https://www.npmjs.com/package/vibe-coding-stats)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**[Try the live demo](https://coffee-cpu.github.io/vibe-coding-stats/)**

A TypeScript library for analyzing GitHub repositories to estimate developer activity in a more "human" way — including hours spent coding, coding sessions, and break patterns.

**Optimized for vibe coding workflows** with session-based commit patterns. The default session timeout (45 minutes) and assumptions work best for repositories with frequent, smaller commits rather than infrequent large commits.

## Features

- 📊 **Coding Metrics**: Estimate total hours, sessions, streaks, and commits
- 📈 **Productivity Insights**: Track longest sessions, average session duration, most productive day of week, minimum break time, and commit frequency patterns
- 🌍 **Timezone Support**: Convert timestamps to any timezone
- 🤖 **Bot Filtering**: Automatically exclude bot commits
- 📅 **Flexible Date Ranges**: Analyze specific time periods
- 🎯 **Author Filtering**: Focus on specific contributors
- 🚀 **TypeScript First**: Full type safety and IntelliSense support

## Installation

```bash
npm install vibe-coding-stats
```

## Quick Start

```typescript
import { getRepoStats } from 'vibe-coding-stats';

// Minimal example - uses default settings
const result = await getRepoStats({ repo: 'coffee-cpu/vibe-coding-stats' });

// All aggregate metrics are in the 'totals' property
console.log(`Total development time: ${result.totals.totalHours} hours`);
console.log(`Across ${result.totals.devDays} days of development`);
console.log(`In ${result.totals.sessionsCount} coding sessions`);
```

## Response Structure

The `getRepoStats()` function returns a structured object:

```typescript
{
  repo: string;              // Repository identifier (e.g., "owner/repo")
  period: {
    since?: string;
    until?: string;
  };
  config: {
    sessionTimeoutMin: number;
    firstCommitBonusMin: number;
    timezone: string;
  };
  totals: {                  // ← Aggregate statistics across all authors
    totalHours: number;
    sessionsCount: number;
    devDays: number;
    totalCommits: number;
    avgCommitsPerSession: number;
    avgSessionsPerDay: number;
    longestSessionHours: number;
    avgSessionHours: number;
    mostProductiveDayOfWeek?: string;
    longestStreakDays: number;
    minTimeBetweenSessionsMin?: number;
    avgMinutesBetweenCommits?: number;
    maxMinutesBetweenCommits?: number;
  };
  perAuthor: Array<{         // ← Per-author breakdown
    author: string;
    authorLogin?: string;    // GitHub username (profile: https://github.com/{authorLogin})
    totalHours: number;
    sessionsCount: number;
    devDays: number;
    totalCommits: number;
    avgCommitsPerSession: number;
    avgSessionsPerDay: number;
    longestSessionHours: number;
    avgSessionHours: number;
    mostProductiveDayOfWeek?: string;
    longestStreakDays: number;
    minTimeBetweenSessionsMin?: number;
    avgMinutesBetweenCommits?: number;
    maxMinutesBetweenCommits?: number;
  }>;
  perDay: Array<{            // ← Daily breakdown
    date: string;
    totalHours: number;
    sessionsCount: number;
    totalCommits: number;
    authors: string[];
  }>;
}
```

## Usage Examples

### Personal Coding Stats for 2024

```typescript
const result = await getRepoStats(
  { repo: 'coffee-cpu/vibe-coding-stats' },
  {
    since: '2024-01-01',
    until: '2024-12-31',
    authors: ['coffee-cpu'],
  }
);

console.log(`In 2024, you coded for ${result.totals.totalHours} hours`);
console.log(`Longest session: ${result.totals.longestSessionHours} hours`);
console.log(`Most productive day: ${result.totals.mostProductiveDayOfWeek}`);
```

### Last 30 Days with Timezone

```typescript
const result = await getRepoStats(
  { url: 'https://github.com/coffee-cpu/vibe-coding-stats' },
  {
    since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    timezone: 'America/New_York',
  }
);

// Access totals
console.log(`Total hours (last 30 days): ${result.totals.totalHours}`);
console.log(`Sessions: ${result.totals.sessionsCount}`);

// View per-author breakdown with GitHub profile links
result.perAuthor.forEach(author => {
  const profileUrl = author.authorLogin ? `https://github.com/${author.authorLogin}` : null;
  console.log(`${author.author}: ${author.totalHours}h, ${author.sessionsCount} sessions`);
  if (profileUrl) {
    console.log(`  GitHub: ${profileUrl}`);
  }
  if (author.avgMinutesBetweenCommits) {
    console.log(`  Avg commit gap: ${author.avgMinutesBetweenCommits.toFixed(1)} minutes`);
  }
});
```

### With GitHub Token (Higher Rate Limits)

```typescript
const result = await getRepoStats(
  { repo: 'coffee-cpu/vibe-coding-stats' },
  {
    githubToken: process.env.GITHUB_TOKEN,
  }
);

console.log(`Total hours: ${result.totals.totalHours}`);
console.log(`Commits: ${result.totals.totalCommits}`);
```

## API Reference

### `getRepoStats(repoInput, options?)`

Main function to get repository statistics.

**Parameters:**

1. `repoInput` - Repository identifier (required):
```typescript
{ repo: string }  // "owner/repo"
// OR
{ url: string }   // "https://github.com/owner/repo"
```

2. `options` - Configuration options (optional):
```typescript
{
  // Session configuration
  sessionTimeoutMin?: number;     // default: 45
  firstCommitBonusMin?: number;   // default: 15

  // Filters
  since?: string | Date;
  until?: string | Date;
  authors?: string[];
  excludeBots?: boolean;          // default: true
  excludeMergeCommits?: boolean;  // default: false

  // Settings
  timezone?: string;              // default: "UTC"
  githubToken?: string;           // optional, for higher rate limits
  perPage?: number;               // default: 100
  maxPages?: number;

  // Caching
  cache?: 'memory' | 'none';      // default: 'memory'
  cacheTTLms?: number;            // default: 900000 (15 min)
}
```

**Returns:**

```typescript
Promise<{
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
    longestSessionHours: number;
    avgSessionHours: number;
    mostProductiveDayOfWeek?: string;
    longestStreakDays: number;
    minTimeBetweenSessionsMin?: number;
    avgMinutesBetweenCommits?: number;
    maxMinutesBetweenCommits?: number;
  };
  perAuthor: AuthorStats[];
  perDay: DayStats[];
}>
```

### Cache Utilities

```typescript
import { clearCache, getCacheSize } from 'vibe-coding-stats';

// Clear the in-memory cache
clearCache();

// Get number of cached entries
const size = getCacheSize();
console.log(`Cache has ${size} entries`);
```

## Common Pitfalls

### GitHub Rate Limiting

Unauthenticated requests are limited to 60 per hour. For production use or analyzing large repositories, provide a GitHub token:

```typescript
const result = await getRepoStats(
  { repo: 'owner/repo' },
  { githubToken: process.env.GITHUB_TOKEN }
);
```

Get a GitHub token from: https://github.com/settings/tokens (requires `public_repo` scope for public repos)

## TypeScript Support

The package includes full TypeScript type definitions:

```typescript
import { getRepoStats, type RepoStats } from 'vibe-coding-stats';

async function fetchStats(): Promise<RepoStats> {
  const result = await getRepoStats(
    { repo: 'owner/repo' },
    { sessionTimeoutMin: 45 }
  );

  // TypeScript knows the structure of result.totals
  const hours: number = result.totals.totalHours;

  return result;
}
```

You can also import individual types:

```typescript
import type {
  RepoStats,
  AuthorStats,
  DayStats,
  StatsOptions
} from 'vibe-coding-stats';
```

## How It Works

### Session Detection

A **coding session** is defined as a series of commits by the same author where consecutive commits are no more than `sessionTimeoutMin` minutes apart (default: 45 minutes).

Session duration is calculated as:
```
duration = (lastCommitTime - firstCommitTime) + firstCommitBonusMin
```

For single-commit sessions:
```
duration = firstCommitBonusMin (default: 15 minutes)
```

### Cross-Midnight Sessions

Sessions can span across midnight and are treated as a single continuous session. The session is assigned to the day it started (based on the first commit's timestamp in the configured timezone).

### Metrics Definitions

- **totalHours**: Sum of all session durations
- **sessionsCount**: Number of distinct coding sessions
- **devDays**: Number of calendar days with at least one commit
- **totalCommits**: Total commit count after filtering
- **avgCommitsPerSession**: totalCommits / sessionsCount
- **avgSessionsPerDay**: sessionsCount / devDays
- **longestSessionHours**: Duration of the longest single coding session
- **avgSessionHours**: Average duration of coding sessions (totalHours / sessionsCount)
- **mostProductiveDayOfWeek**: Day of week with most total coding hours (e.g., "Monday")
- **longestStreakDays**: Longest consecutive days with commits
- **minTimeBetweenSessionsMin**: Minimum time between consecutive sessions by the same author (in minutes)
- **avgMinutesBetweenCommits**: Average time in minutes between consecutive commits within sessions (undefined if all sessions are single-commit)
- **maxMinutesBetweenCommits**: Maximum time in minutes between consecutive commits within sessions (undefined if all sessions are single-commit)

## Limitations

This library provides **approximate** coding activity metrics based on commit history:

- **Only committed work is counted** - Work in progress, uncommitted changes, and experimental branches are not captured
- **Rebases and force-pushes may affect accuracy** - Git history rewriting can alter timestamps and commit counts
- **Doesn't capture non-coding time** - Code review, meetings, debugging, research, and thinking time are not measured
- **Session detection is heuristic** - The timeout-based approach may occasionally split or merge sessions incorrectly
- **Author identification** - Based on Git author info, which can be inconsistent across different machines or configurations

## Development

```bash
# Install dependencies
npm install

# Build the library
npm run build -w packages/core

# Run tests
npm test -w packages/core

# Run tests in watch mode
npm run test:watch -w packages/core

# Type check
npm run type-check

# Run demo locally
npm run dev -w demo
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
