import { useState } from 'react';

interface ShareButtonProps {
  repo: string;
}

function ShareButton({ repo }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    // Normalize repo to owner/repo format
    // If it's a full URL, extract owner/repo from it
    let normalizedRepo = repo;
    if (repo.includes('github.com')) {
      const match = repo.match(/github\.com\/([^/]+\/[^/]+)/);
      if (match) {
        normalizedRepo = match[1];
      }
    }

    const url = `${window.location.origin}${window.location.pathname}?repo=${encodeURIComponent(normalizedRepo)}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-coffee-600 to-coffee-700 hover:from-coffee-700 hover:to-coffee-800 text-white font-semibold rounded-lg shadow-warm hover:shadow-warm-lg transition-all"
      title="Copy shareable link"
    >
      {copied ? (
        <>
          <span className="text-lg">✓</span>
          <span>Copied!</span>
        </>
      ) : (
        <>
          <span className="text-lg">🔗</span>
          <span>Share</span>
        </>
      )}
    </button>
  );
}

export default ShareButton;
