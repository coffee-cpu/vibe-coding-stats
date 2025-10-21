# vibe-coding-stats

[![npm version](https://img.shields.io/npm/v/vibe-coding-stats.svg)](https://www.npmjs.com/package/vibe-coding-stats)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A TypeScript library for analyzing GitHub repositories to estimate developer activity in a more "human" way — including hours spent coding, coding sessions, and coffee cups consumed.

**Optimized for vibe coding workflows** with session-based commit patterns. The default session timeout (45 minutes) and assumptions work best for repositories with frequent, smaller commits rather than infrequent large commits.

## Features

- 📊 **Coding Metrics**: Estimate total hours, sessions, and commits
- ☕ **Fun Stats**: Track coffee cups (one per session!)
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

// Analyze a repository
const stats = await getRepoStats(
  { repo: 'coffee-cpu/vibe-coding-stats' }
);

console.log(`Total coding hours: ${stats.totals.totalHours}`);
console.log(`Coffee cups: ${stats.totals.coffeeCups} ☕`);
```

## Usage Examples

### Personal Coding Stats for 2024

```typescript
const myStats = await getRepoStats(
  { repo: 'username/my-project' },
  {
    since: '2024-01-01',
    until: '2024-12-31',
    authors: ['my-github-username'],
  }
);
```

### Team Activity Comparison

```typescript
const teamStats = await getRepoStats(
  { url: 'https://github.com/coffee-cpu/vibe-coding-stats' },
  {
    since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // last 30 days
    timezone: 'America/New_York',
  }
);

// View per-author breakdown
teamStats.perAuthor.forEach(author => {
  console.log(`${author.author}: ${author.totalHours}h, ${author.coffeeCups}☕`);
});
```

### Open Source Project Analysis

```typescript
const ossStats = await getRepoStats(
  { repo: 'microsoft/vscode' },
  {
    excludeBots: true,
    sessionTimeoutMin: 60, // longer timeout for OSS
  }
);
```

### With GitHub Token (Higher Rate Limits)

```typescript
const stats = await getRepoStats(
  { repo: 'owner/repo' },
  {
    githubToken: process.env.GITHUB_TOKEN,
  }
);
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
    coffeeCups: number;
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
- **coffeeCups**: sessionsCount (one cup per session ☕)

## Limitations

This library provides **approximate** coding activity metrics based on commit history:

- **Only committed work is counted** - Work in progress, uncommitted changes, and experimental branches are not captured
- **Rebases and force-pushes may affect accuracy** - Git history rewriting can alter timestamps and commit counts
- **Doesn't capture non-coding time** - Code review, meetings, debugging, research, and thinking time are not measured
- **Session detection is heuristic** - The timeout-based approach may occasionally split or merge sessions incorrectly
- **Author identification** - Based on Git author info, which can be inconsistent across different machines or configurations

## Demo

Try the live demo at: [https://coffee-cpu.github.io/vibe-coding-stats/](https://coffee-cpu.github.io/vibe-coding-stats/)

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

## Roadmap

- **v0.1**: Core metrics + cross-midnight sessions + GitHub Pages demo
- **v0.2**: Enhanced caching, progress UI, better visualizations
