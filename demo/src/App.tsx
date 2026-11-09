import { useCallback, useEffect, useRef, useState } from 'react';
import { getRepoStats, StatsError, type RepoStats } from 'vibe-coding-stats';
import RepoInput from './components/RepoInput';
import StatsDisplay from './components/StatsDisplay';
import { normalizeRepo, toRepoInput } from './repo';

function describeError(err: unknown, hasToken: boolean): string {
  if (err instanceof StatsError && err.code === 'RATE_LIMIT' && !hasToken) {
    return `${err.message}. Unauthenticated requests are limited to 60 per hour — add a GitHub token under "Advanced" to raise the limit.`;
  }
  return err instanceof Error ? err.message : 'Failed to analyze repository';
}

// Each page is one API request of 100 commits. Without a token GitHub allows
// 60 requests per hour, so keep anonymous runs small enough to repeat.
const MAX_PAGES_ANONYMOUS = 10;
const MAX_PAGES_WITH_TOKEN = 50;

function maxPagesFor(hasToken: boolean): number {
  return hasToken ? MAX_PAGES_WITH_TOKEN : MAX_PAGES_ANONYMOUS;
}

function repoFromLocation(): string | null {
  return new URLSearchParams(window.location.search).get('repo');
}

function App() {
  const [stats, setStats] = useState<RepoStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentRepo, setCurrentRepo] = useState<string>('');
  // Whether the stats on screen were fetched with a token (sets the page cap)
  const [usedToken, setUsedToken] = useState(false);
  // Kept in memory only; never written to the URL or browser storage
  const tokenRef = useRef<string | undefined>(undefined);
  // Ignore results of requests superseded by a newer one
  const requestId = useRef(0);

  const analyze = useCallback(async (repo: string, { updateUrl }: { updateUrl: boolean }) => {
    const id = ++requestId.current;
    const githubToken = tokenRef.current;
    setCurrentRepo(repo);
    setLoading(true);
    setError(null);
    setStats(null);

    try {
      const result = await getRepoStats(toRepoInput(repo), {
        githubToken,
        maxPages: maxPagesFor(Boolean(githubToken)),
      });
      if (id !== requestId.current) return;
      setUsedToken(Boolean(githubToken));
      setStats(result);

      if (updateUrl) {
        const params = new URLSearchParams(window.location.search);
        params.set('repo', normalizeRepo(repo));
        window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
      }
    } catch (err) {
      if (id !== requestId.current) return;
      setError(describeError(err, Boolean(githubToken)));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  // Load the repo from the URL on mount and whenever the user navigates back/forward
  useEffect(() => {
    const loadFromLocation = () => {
      const repo = repoFromLocation();
      if (repo) {
        void analyze(repo, { updateUrl: false });
      } else {
        requestId.current++;
        setStats(null);
        setError(null);
        setLoading(false);
      }
    };

    loadFromLocation();
    window.addEventListener('popstate', loadFromLocation);
    return () => window.removeEventListener('popstate', loadFromLocation);
  }, [analyze]);

  const handleAnalyze = (repo: string, githubToken?: string) => {
    tokenRef.current = githubToken || undefined;
    void analyze(repo, { updateUrl: true });
  };

  return (
    <div className="min-h-screen flex flex-col p-6 lg:p-12">
      <header className="text-center mb-12 space-y-4">
        <div className="flex items-center justify-center gap-3 mb-4">
          <h1 className="text-5xl lg:text-6xl font-bold text-gradient coffee-glow leading-tight pb-2">
            Vibe Coding Stats
          </h1>
        </div>
        <p className="text-lg lg:text-xl text-coffee-700 font-normal max-w-2xl mx-auto">
          Brew up insights from GitHub repositories • Discover developer activity with a warm, cozy
          touch
        </p>
        <div className="flex items-center justify-center gap-2 text-coffee-600">
          <span className="text-sm font-medium">Powered by coffee and code</span>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto space-y-8">
        <RepoInput onAnalyze={handleAnalyze} loading={loading} initialRepo={currentRepo} />

        {error && (
          <div
            className="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg shadow-warm"
            role="alert"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <p className="text-red-800 font-medium">{error}</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-warm-xl p-12 text-center">
            <div className="inline-block animate-spin text-6xl mb-4">⏳</div>
            <p className="text-xl text-coffee-700 font-medium">Analyzing repository...</p>
            <p className="text-sm text-coffee-500 mt-2">Processing commits and sessions</p>
          </div>
        )}

        {stats && !loading && stats.truncated && (
          <div
            className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-lg shadow-warm"
            role="status"
            data-testid="truncated-notice"
          >
            <p className="text-amber-900">
              Showing the most recent {(maxPagesFor(usedToken) * 100).toLocaleString()} commits
              only.
              {usedToken
                ? ' Older history was not analyzed.'
                : ' Add a GitHub token under "Advanced" to analyze more of the history.'}
            </p>
          </div>
        )}

        {stats && !loading && <StatsDisplay stats={stats} />}
      </main>

      <footer className="text-center mt-16 pt-8 border-t border-coffee-200">
        <p className="text-coffee-600">
          Built with{' '}
          <a
            href="https://github.com/coffee-cpu/vibe-coding-stats"
            target="_blank"
            rel="noopener noreferrer"
            className="text-coffee-700 hover:text-coffee-900 font-semibold underline decoration-coffee-300 hover:decoration-coffee-500 transition-colors"
          >
            vibe-coding-stats
          </a>{' '}
          • Made with ❤️
        </p>
      </footer>
    </div>
  );
}

export default App;
