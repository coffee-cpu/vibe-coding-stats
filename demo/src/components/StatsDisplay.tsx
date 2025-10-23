import { type RepoStats } from 'vibe-coding-stats';
import ShareButton from './ShareButton';

interface StatsDisplayProps {
  stats: RepoStats;
}

function StatsDisplay({ stats }: StatsDisplayProps) {
  const { totals, perAuthor, repo } = stats;

  const statCards = [
    { icon: '⏱️', value: totals.totalHours.toFixed(1), label: 'Total Hours', color: 'from-coffee-500 to-coffee-600' },
    { icon: '💻', value: totals.sessionsCount, label: 'Coding Sessions', color: 'from-coffee-600 to-coffee-700' },
    { icon: '🔥', value: `${totals.longestSessionHours.toFixed(1)}h`, label: 'Longest Session', color: 'from-amber-500 to-orange-600' },
    { icon: '⏳', value: `${totals.avgSessionHours.toFixed(1)}h`, label: 'Avg Session', color: 'from-blue-500 to-blue-600' },
    { icon: '📅', value: totals.devDays, label: 'Dev Days', color: 'from-cream-500 to-cream-600' },
    { icon: '📝', value: totals.totalCommits, label: 'Total Commits', color: 'from-coffee-400 to-coffee-500' },
    { icon: '📊', value: totals.avgCommitsPerSession.toFixed(2), label: 'Avg Commits/Session', color: 'from-cream-600 to-cream-700' },
    { icon: '🎯', value: `${totals.longestStreakDays} days`, label: 'Longest Streak', color: 'from-green-500 to-green-600' },
    ...(totals.mostProductiveDayOfWeek ? [{ icon: '📆', value: totals.mostProductiveDayOfWeek, label: 'Top Day of Week', color: 'from-purple-500 to-purple-600' }] : []),
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
        <p className="text-base sm:text-lg text-coffee-600 text-center">{repo} stats</p>
        <ShareButton repo={repo} />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 lg:gap-4">
        {statCards.map((stat, index) => (
          <div
            key={stat.label}
            className="bg-white/90 backdrop-blur-sm rounded-xl shadow-warm hover:shadow-warm-lg transition-all duration-300 p-4 border border-coffee-100 hover:border-coffee-300 group"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="text-center space-y-2">
              <div className="text-3xl group-hover:scale-110 transition-transform duration-300">
                {stat.icon}
              </div>
              <div className={`text-2xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                {stat.value}
              </div>
              <div className="text-xs font-semibold text-coffee-700 uppercase tracking-wide">
                {stat.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Contributors Section */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-warm-lg p-6 lg:p-8 border border-coffee-200">
        <h3 className="text-2xl font-bold text-coffee-800 mb-6 flex items-center gap-2">
          <span>👥</span>
          <span>Contributors</span>
          <span className="text-sm font-normal text-coffee-600">({perAuthor.length})</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {perAuthor.map((author, index) => (
            <div
              key={author.author}
              className="bg-gradient-to-br from-cream-50 to-coffee-50 rounded-xl p-5 border-2 border-coffee-200 hover:border-coffee-400 transition-all duration-300 hover:shadow-warm"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-coffee-600 to-coffee-700 flex items-center justify-center text-white font-bold text-lg shadow-warm">
                  {author.author.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-coffee-900 truncate" title={author.author}>
                    {author.author}
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center bg-white/60 rounded-lg px-3 py-2">
                  <span className="text-coffee-700 font-medium">⏱️ Hours:</span>
                  <span className="font-bold text-coffee-900">{author.totalHours.toFixed(1)}</span>
                </div>
                <div className="flex justify-between items-center bg-white/60 rounded-lg px-3 py-2">
                  <span className="text-coffee-700 font-medium">🔥 Longest:</span>
                  <span className="font-bold text-coffee-900">{author.longestSessionHours.toFixed(1)}h</span>
                </div>
                <div className="flex justify-between items-center bg-white/60 rounded-lg px-3 py-2">
                  <span className="text-coffee-700 font-medium">💻 Sessions:</span>
                  <span className="font-bold text-coffee-900">{author.sessionsCount}</span>
                </div>
                <div className="flex justify-between items-center bg-white/60 rounded-lg px-3 py-2">
                  <span className="text-coffee-700 font-medium">📝 Commits:</span>
                  <span className="font-bold text-coffee-900">{author.totalCommits}</span>
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
