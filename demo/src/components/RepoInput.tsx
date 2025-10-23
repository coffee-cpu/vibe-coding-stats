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
        <label htmlFor="repo-url" className="block text-sm font-semibold text-coffee-700 mb-2">
          GitHub Repository
        </label>
        <p className="text-xs text-coffee-600 mb-3 flex items-start gap-1.5">
          <span>💡</span>
          <span>Enter owner/repo or full URL</span>
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            id="repo-url"
            className="flex-1 px-4 py-3 rounded-lg border-2 border-coffee-200 focus:border-coffee-500 focus:outline-none focus:ring-2 focus:ring-coffee-300 transition-all bg-white text-coffee-900 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="coffee-cpu/vibe-coding-stats"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            disabled={loading}
            required
          />
          <button
            type="submit"
            className="sm:w-auto px-8 py-3 bg-gradient-to-r from-coffee-600 to-coffee-700 hover:from-coffee-700 hover:to-coffee-800 text-white font-semibold rounded-lg shadow-warm hover:shadow-warm-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            disabled={loading || !repoUrl.trim()}
          >
            Analyze
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-coffee-100">
          <details className="group">
            <summary className="text-xs text-coffee-600 font-medium cursor-pointer hover:text-coffee-800 transition-colors list-none flex items-center gap-1.5">
              <span className="transform transition-transform group-open:rotate-90">▶</span>
              <span>Examples</span>
            </summary>
            <div className="mt-3 ml-4 space-y-2 text-xs">
              <button
                type="button"
                onClick={() => setRepoUrl('coffee-cpu/vibe-coding-stats')}
                className="group block w-full text-left text-coffee-700 hover:text-coffee-900 transition-all font-mono cursor-pointer hover:bg-coffee-50 rounded px-2 py-1.5 -ml-2"
                disabled={loading}
              >
                <span className="inline-block underline decoration-coffee-400 decoration-2 group-hover:decoration-coffee-600">coffee-cpu/vibe-coding-stats</span>
              </button>
              <button
                type="button"
                onClick={() => setRepoUrl('https://github.com/coffee-cpu/vibe-coding-stats')}
                className="group block w-full text-left text-coffee-700 hover:text-coffee-900 transition-all font-mono cursor-pointer hover:bg-coffee-50 rounded px-2 py-1.5 -ml-2"
                disabled={loading}
              >
                <span className="inline-block break-all underline decoration-coffee-400 decoration-2 group-hover:decoration-coffee-600">https://github.com/coffee-cpu/vibe-coding-stats</span>
              </button>
            </div>
          </details>
        </div>
      </div>
    </form>
  );
}

export default RepoInput;
