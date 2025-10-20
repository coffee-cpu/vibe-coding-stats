import { RepoStats } from '../App';
import './StatsDisplay.css';

interface StatsDisplayProps {
  stats: RepoStats;
}

function StatsDisplay({ stats }: StatsDisplayProps) {
  return (
    <div className="stats-display">
      <h2>Repository Statistics</h2>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">⏱️</div>
          <div className="stat-value">{stats.totalHours.toFixed(1)}</div>
          <div className="stat-label">Total Hours</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">💻</div>
          <div className="stat-value">{stats.sessionsCount}</div>
          <div className="stat-label">Coding Sessions</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-value">{stats.devDays}</div>
          <div className="stat-label">Dev Days</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📝</div>
          <div className="stat-value">{stats.totalCommits}</div>
          <div className="stat-label">Total Commits</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-value">{stats.avgCommitsPerSession.toFixed(2)}</div>
          <div className="stat-label">Avg Commits/Session</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">☕</div>
          <div className="stat-value">{stats.coffeeCups}</div>
          <div className="stat-label">Coffee Cups</div>
        </div>
      </div>

      <div className="authors-section">
        <h3>Contributors</h3>
        <div className="authors-list">
          {Object.entries(stats.perAuthor).map(([key, author]) => (
            <div key={key} className="author-card">
              <div className="author-header">
                <div className="author-avatar">
                  {author.name.charAt(0).toUpperCase()}
                </div>
                <div className="author-info">
                  <div className="author-name">{author.name}</div>
                  <div className="author-email">{author.email}</div>
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
                <div className="author-stat">
                  <span className="author-stat-label">Coffee:</span>
                  <span className="author-stat-value">{author.coffeeCups} ☕</span>
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
