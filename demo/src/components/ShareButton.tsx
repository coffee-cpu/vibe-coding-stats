import { useEffect, useRef, useState } from 'react';
import { normalizeRepo } from '../repo';

interface ShareButtonProps {
  repo: string;
}

function ShareButton({ repo }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  const handleShare = async () => {
    const url = `${window.location.origin}${window.location.pathname}?repo=${encodeURIComponent(normalizeRepo(repo))}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-coffee-600 to-coffee-700 hover:from-coffee-700 hover:to-coffee-800 text-white text-sm font-semibold rounded-lg shadow-warm hover:shadow-warm-lg transition-all"
      title="Copy shareable link"
    >
      {copied ? (
        <>
          <span className="text-sm">✓</span>
          <span>Copied!</span>
        </>
      ) : (
        <>
          <span className="text-sm">🔗</span>
          <span>Share</span>
        </>
      )}
    </button>
  );
}

export default ShareButton;
