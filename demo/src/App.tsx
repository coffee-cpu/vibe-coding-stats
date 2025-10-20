import { useState } from 'react';
import RepoInput from './components/RepoInput';
import StatsDisplay from './components/StatsDisplay';
import './App.css';

export interface RepoStats {
  totalHours: number;
  sessionsCount: number;
  devDays: number;
  totalCommits: number;
  avgCommitsPerSession: number;
  avgSessionsPerDay: number;
  coffeeCups: number;
  perAuthor: Record<string, AuthorStats>;
}

export interface AuthorStats {
  name: string;
  email: string;
  totalHours: number;
  sessionsCount: number;
  devDays: number;
  totalCommits: number;
  coffeeCups: number;
}

function App() {
  const [stats, setStats] = useState<RepoStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (repoUrl: string) => {
    setLoading(true);
    setError(null);
    setStats(null);

    try {
      // For now, generate mock data since the core library might not be built yet
      // In production, this would call: await analyzeRepo({ url: repoUrl })

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Mock stats for demonstration
      const mockStats: RepoStats = {
        totalHours: 127.5,
        sessionsCount: 45,
        devDays: 23,
        totalCommits: 156,
        avgCommitsPerSession: 3.47,
        avgSessionsPerDay: 1.96,
        coffeeCups: 45,
        perAuthor: {
          'author1': {
            name: 'Main Developer',
            email: 'dev@example.com',
            totalHours: 95.25,
            sessionsCount: 32,
            devDays: 18,
            totalCommits: 112,
            coffeeCups: 32,
          },
          'author2': {
            name: 'Contributor',
            email: 'contributor@example.com',
            totalHours: 32.25,
            sessionsCount: 13,
            devDays: 9,
            totalCommits: 44,
            coffeeCups: 13,
          },
        },
      };

      setStats(mockStats);
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
