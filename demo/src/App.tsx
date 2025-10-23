import { useState, useEffect } from 'react';
import { getRepoStats, type RepoStats } from 'vibe-coding-stats';
import RepoInput from './components/RepoInput';
import StatsDisplay from './components/StatsDisplay';

function App() {
  const [stats, setStats] = useState<RepoStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentRepo, setCurrentRepo] = useState<string>('');

  // Get repo from URL parameter on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const repoParam = params.get('repo');

    if (repoParam) {
      const analyzeFromUrl = async () => {
        setCurrentRepo(repoParam);
        setLoading(true);
        setError(null);
        setStats(null);

        try {
          const isUrl = repoParam.includes('github.com') || repoParam.startsWith('http');
          const repoInput = isUrl ? { url: repoParam } : { repo: repoParam };
          const stats = await getRepoStats(repoInput, {});
          setStats(stats);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to analyze repository');
        } finally {
          setLoading(false);
        }
      };

      analyzeFromUrl();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAnalyze = async (repoUrl: string) => {
    setLoading(true);
    setError(null);
    setStats(null);

    try {
      // Detect if input is a URL or short format (owner/repo)
      const isUrl = repoUrl.includes('github.com') || repoUrl.startsWith('http');
      const repoInput = isUrl ? { url: repoUrl } : { repo: repoUrl };

      const stats = await getRepoStats(repoInput, {});
      setStats(stats);
      setCurrentRepo(repoUrl);

      // Update URL without reloading the page
      const params = new URLSearchParams(window.location.search);
      params.set('repo', repoUrl);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.pushState({}, '', newUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze repository');
    } finally {
      setLoading(false);
    }
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
          Brew up insights from GitHub repositories • Discover developer activity with a warm, cozy touch
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
            <p className="text-xl text-coffee-700 font-medium">
              Analyzing repository...
            </p>
            <p className="text-sm text-coffee-500 mt-2">
              Processing commits and sessions
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
          </a>
          {' '}• Made with ❤️
        </p>
      </footer>
    </div>
  );
}

export default App;
