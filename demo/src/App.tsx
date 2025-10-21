import { useState } from 'react';
import { getRepoStats, type RepoStats, type AuthorStats } from 'vibe-coding-stats';
import RepoInput from './components/RepoInput';
import StatsDisplay from './components/StatsDisplay';
import './App.css';

function App() {
  const [stats, setStats] = useState<RepoStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (repoUrl: string) => {
    setLoading(true);
    setError(null);
    setStats(null);

    try {
      const stats = await getRepoStats({ url: repoUrl }, {});
      setStats(stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze repository');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Vibe Coding Stats</h1>
        <p>Analyze GitHub repositories to estimate developer activity</p>
      </header>

      <main className="app-main">
        <RepoInput onAnalyze={handleAnalyze} loading={loading} />

        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}

        {loading && (
          <div className="loading-message">
            <div className="spinner"></div>
            <p>Analyzing repository...</p>
          </div>
        )}

        {stats && !loading && <StatsDisplay stats={stats} />}
      </main>

      <footer className="app-footer">
        <p>
          Built with <a href="https://github.com/coffee-cpu/vibe-coding-stats" target="_blank" rel="noopener noreferrer">vibe-coding-stats</a>
        </p>
      </footer>
    </div>
  );
}

export default App;
