import { useState } from 'react';

// Simple syntax highlighter (no external lib needed — zero dependencies)
function highlight(code) {
  return code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Strings (handles single, double, template literals)
    .replace(/(["`])((?:[^\\]|\\.)*?)\1/g, '<span style="color:#c3e88d">$1$2$1</span>')
    .replace(/('(?:[^'\\]|\\.)*')/g, '<span style="color:#c3e88d">$1</span>')
    // Keywords
    .replace(/\b(const|let|var|function|return|if|else|for|while|do|class|import|export|default|async|await|try|catch|finally|throw|new|this|typeof|instanceof|null|undefined|true|false|of|in|break|continue|switch|case)\b/g,
      '<span style="color:#c792ea">$1</span>')
    // Numbers
    .replace(/\b(\d+\.?\d*)\b/g, '<span style="color:#f78c6c">$1</span>')
    // Comments
    .replace(/(\/\/[^\n]*)/g, '<span style="color:#546e7a;font-style:italic">$1</span>')
    // Function calls
    .replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g, '<span style="color:#82aaff">$1</span>(');
}

export default function CodeBlock({ code, language = 'js', label = '' }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{
      background: '#0d0d15',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      overflow: 'hidden',
      margin: '8px 0',
      fontSize: '13px'
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 12px',
        background: 'var(--bg3)',
        borderBottom: '1px solid var(--border)'
      }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
          {label || language}
        </span>
        <button
          onClick={copy}
          style={{
            background: copied ? 'var(--green-dim)' : 'transparent',
            border: '1px solid var(--border)',
            color: copied ? 'var(--green)' : 'var(--text-dim)',
            padding: '2px 8px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            transition: 'all 0.2s'
          }}
        >
          {copied ? '✓ copied' : 'copy'}
        </button>
      </div>

      {/* Code with syntax highlighting */}
      <pre style={{
        padding: '14px 16px',
        overflowX: 'auto',
        lineHeight: '1.6',
        fontFamily: 'var(--font-mono)',
        color: 'var(--text)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word'
      }}>
        <code dangerouslySetInnerHTML={{ __html: highlight(code) }} />
      </pre>
    </div>
  );
}
