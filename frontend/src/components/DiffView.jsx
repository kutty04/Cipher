import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import CopyButton from './CopyButton.jsx';

export default function DiffView({ oldCode, newCode, language = 'javascript' }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '1px',
      background: 'var(--border)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      overflow: 'hidden',
      margin: '20px 0'
    }}>
      <div style={{
        display: 'flex',
        background: 'var(--bg2)',
        fontSize: '11px',
        fontWeight: 600,
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-muted)'
      }}>
        <div style={{ flex: 1, padding: '8px 16px', borderRight: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--red)' }}>●</span> BEFORE (OLD)
        </div>
        <div style={{ flex: 1, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--green)' }}>●</span> AFTER (FIXED)
        </div>
      </div>
      
      <div style={{ display: 'flex', background: 'var(--bg)' }}>
        <div style={{ flex: 1, borderRight: '1px solid var(--border)', overflowX: 'auto' }}>
          <SyntaxHighlighter
            language={language}
            style={atomDark}
            customStyle={{ margin: 0, padding: '16px', fontSize: '13px', background: 'transparent' }}
          >
            {oldCode}
          </SyntaxHighlighter>
        </div>
        <div style={{ flex: 1, overflowX: 'auto', position: 'relative' }}>
          <CopyButton text={newCode} />
          <SyntaxHighlighter
            language={language}
            style={atomDark}
            customStyle={{ margin: 0, padding: '16px', fontSize: '13px', background: 'transparent' }}
          >
            {newCode}
          </SyntaxHighlighter>
        </div>
      </div>
    </div>
  );
}
