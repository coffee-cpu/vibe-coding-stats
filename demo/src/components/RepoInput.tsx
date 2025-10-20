import { useState } from 'react';
import './RepoInput.css';

interface RepoInputProps {
  onAnalyze: (repoUrl: string) => void;
  loading: boolean;
}

function RepoInput({ onAnalyze, loading }: RepoInputProps) {
  const [repoUrl, setRepoUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (repoUrl.trim()) {
      onAnalyze(repoUrl.trim());
    }
  };

  return (
    <form className="repo-input" onSubmit={handleSubmit}>
      <div className="input-group">
        <input
          type="text"
          id="repo-url"
          className="repo-input-field"
          placeholder="https://github.com/owner/repo"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          disabled={loading}
          required
        />
        <button
          type="submit"
          className="analyze-button"
          disabled={loading || !repoUrl.trim()}
        >
          Analyze
        </button>
      </div>
      <p className="input-hint">
        Enter a GitHub repository URL to analyze coding activity
      </p>
    </form>
  );
}

export default RepoInput;
