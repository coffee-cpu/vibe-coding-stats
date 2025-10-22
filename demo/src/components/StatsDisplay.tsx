import { type RepoStats } from 'vibe-coding-stats';
import './StatsDisplay.css';

interface StatsDisplayProps {
  stats: RepoStats;
}

function StatsDisplay({ stats }: StatsDisplayProps) {
  const { totals, perAuthor, repo } = stats;

  return (
    <div className="stats-display">
      <h2>Repository Statistics</h2>
      <p className="repo-name">{repo}</p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">⏱️</div>
          <div className="stat-value">{totals.totalHours.toFixed(1)}</div>
          <div className="stat-label">Total Hours</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">💻</div>
          <div className="stat-value">{totals.sessionsCount}</div>
          <div className="stat-label">Coding Sessions</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-value">{totals.devDays}</div>
          <div className="stat-label">Dev Days</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📝</div>
          <div className="stat-value">{totals.totalCommits}</div>
          <div className="stat-label">Total Commits</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-value">{totals.avgCommitsPerSession.toFixed(2)}</div>
          <div className="stat-label">Avg Commits/Session</div>
        </div>
      </div>

      <div className="authors-section">
        <h3>Contributors</h3>
        <div className="authors-list">
          {perAuthor.map((author) => (
            <div key={author.author} className="author-card">
              <div className="author-header">
                <div className="author-avatar">
                  {author.author.charAt(0).toUpperCase()}
                </div>
                <div className="author-info">
                  <div className="author-name">{author.author}</div>
                </div>
              </div>
              <div className="author-stats">
                <div className="author-stat">
                  <span className="author-stat-label">Hours:</span>
                  <span className="author-stat-value">{author.totalHours.toFixed(1)}</span>
                </div>
                <div className="author-stat">
                  <span className="author-stat-label">Sessions:</span>
                  <span className="author-stat-value">{author.sessionsCount}</span>
                </div>
                <div className="author-stat">
                  <span className="author-stat-label">Commits:</span>
                  <span className="author-stat-value">{author.totalCommits}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default StatsDisplay;
