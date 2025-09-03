'use client';

import { useState } from 'react';

type Props = {
  url?: string;            // optional; defaults to current URL
  className?: string;
  label?: string;
};

export default function ShareLinkButton({
  url,
  className = '',
  label = 'Copy link',
}: Props) {
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onClick() {
    try {
      setErr(null);
      const shareUrl =
        url ??
        (typeof window !== 'undefined' ? window.location.href : '');

      if (!shareUrl) throw new Error('No URL to copy');

      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e: any) {
      setErr(e?.message || 'Unable to copy');
      setTimeout(() => setErr(null), 2000);
    }
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={onClick}
        className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
      >
        <span aria-hidden>🔗</span> {label}
      </button>

      {/* Tiny toast */}
      {copied && (
        <div className="absolute right-0 mt-2 rounded-md bg-black text-white text-xs px-2 py-1 shadow">
          Copied!
        </div>
      )}
      {err && (
        <div className="absolute right-0 mt-2 rounded-md bg-red-600 text-white text-xs px-2 py-1 shadow">
          {err}
        </div>
      )}
    </div>
  );
}
