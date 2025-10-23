import { useState } from 'react';

interface RepoInputProps {
  onAnalyze: (repoUrl: string) => void;
  loading: boolean;
}

function RepoInput({ onAnalyze, loading }: RepoInputProps) {
  const [repoUrl, setRepoUrl] = useState('https://github.com/coffee-cpu/vibe-coding-stats');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (repoUrl.trim()) {
      onAnalyze(repoUrl.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-warm-lg p-6 lg:p-8 border border-coffee-200">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="repo-url" className="block text-sm font-semibold text-coffee-700 mb-2">
              GitHub Repository
            </label>
            <input
              type="text"
              id="repo-url"
              className="w-full px-4 py-3 rounded-lg border-2 border-coffee-200 focus:border-coffee-500 focus:outline-none focus:ring-2 focus:ring-coffee-300 transition-all bg-white text-coffee-900 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="coffee-cpu/vibe-coding-stats"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              disabled={loading}
              required
            />
            <p className="text-xs text-coffee-500 mt-2">
              Supported formats: <code className="bg-coffee-50 px-1.5 py-0.5 rounded text-coffee-700">owner/repo</code> or <code className="bg-coffee-50 px-1.5 py-0.5 rounded text-coffee-700">https://github.com/owner/repo</code>
              {' • '}
              <span className="text-coffee-600">Try: </span>
              <button
                type="button"
                onClick={() => setRepoUrl('coffee-cpu/vibe-coding-stats')}
                className="text-coffee-700 hover:text-coffee-900 underline decoration-coffee-300 hover:decoration-coffee-500 transition-colors"
                disabled={loading}
              >
                coffee-cpu/vibe-coding-stats
              </button>
              {' or '}
              <button
                type="button"
                onClick={() => setRepoUrl('https://github.com/coffee-cpu/vibe-coding-stats')}
                className="text-coffee-700 hover:text-coffee-900 underline decoration-coffee-300 hover:decoration-coffee-500 transition-colors"
                disabled={loading}
              >
                https://github.com/coffee-cpu/vibe-coding-stats
              </button>
            </p>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full lg:w-auto px-8 py-3 bg-gradient-to-r from-coffee-600 to-coffee-700 hover:from-coffee-700 hover:to-coffee-800 text-white font-semibold rounded-lg shadow-warm hover:shadow-warm-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || !repoUrl.trim()}
            >
              Analyze
            </button>
          </div>
        </div>
        <p className="text-sm text-coffee-600 mt-4 flex items-center gap-2">
          <span>💡</span>
          <span>Enter a public GitHub repository to brew up some coding insights</span>
        </p>
      </div>
    </form>
  );
}

export default RepoInput;
