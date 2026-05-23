import { useState } from 'react';

export default function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      style={{
        position: 'absolute',
        top: '8px',
        right: '8px',
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        color: copied ? 'var(--green)' : 'var(--text-dim)',
        padding: '4px 8px',
        borderRadius: '6px',
        fontSize: '11px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        transition: 'all 0.2s ease',
        zIndex: 10,
        fontFamily: 'var(--font-ui)'
      }}
      onMouseOver={e => {
        if (!copied) {
          e.currentTarget.style.borderColor = 'var(--text-dim)';
          e.currentTarget.style.color = 'var(--text)';
        }
      }}
      onMouseOut={e => {
        if (!copied) {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.color = 'var(--text-dim)';
        }
      }}
    >
      {copied ? '✓ Copied' : '📋 Copy'}
    </button>
  );
}
