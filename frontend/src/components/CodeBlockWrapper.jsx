import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import CopyButton from './CopyButton.jsx';
import { runCodeClientSide } from '../utils/BrowserRunner.js';

export default function CodeBlockWrapper({ children, language, ...props }) {
  const [output, setOutput] = useState(null);
  const [running, setRunning] = useState(false);
  const codeText = String(children).replace(/\n$/, '');

  const isExecutable = language === 'javascript' || language === 'js';
  const isPreviewable = language === 'html' || language === 'jsx' || language === 'react' || language === 'js';

  async function handleRun() {
    setRunning(true);
    setOutput('⚡ Initializing browser sandbox...');
    try {
      const logs = await runCodeClientSide(codeText);
      setOutput(logs);
    } catch (e) {
      setOutput(`[ERROR] Sandbox error: ${e.message}`);
    } finally {
      setRunning(false);
    }
  }

  // Trigger global custom event to open the side preview panel
  function handlePreview() {
    const event = new CustomEvent('open-artifact', {
      detail: { code: codeText, language }
    });
    window.dispatchEvent(event);
  }

  return (
    <div style={{
      position: 'relative',
      borderRadius: '12px',
      overflow: 'hidden',
      border: '1px solid var(--border)',
      background: '#0a0d16',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
      margin: '20px 0'
    }}>
      {/* Codeblock Control Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        background: '#0d111d',
        borderBottom: '1px solid var(--border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: isExecutable ? 'var(--accent)' : isPreviewable ? 'var(--green)' : '#444'
          }} />
          <span style={{
            fontSize: '11px', color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.5px'
          }}>
            {language}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isPreviewable && (
            <button
              onClick={handlePreview}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '3px 10px',
                fontSize: '11px',
                color: 'var(--accent)',
                fontFamily: 'var(--font-ui)',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s'
              }}
              onMouseOver={e => e.currentTarget.style.background = 'var(--accent-glow)'}
              onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
            >
              👁️ Preview
            </button>
          )}

          {isExecutable && (
            <button
              onClick={handleRun}
              disabled={running}
              style={{
                background: running ? 'rgba(0,0,0,0.2)' : 'var(--accent-glow)',
                border: '1px solid var(--accent)',
                borderRadius: '6px',
                padding: '3px 10px',
                fontSize: '11px',
                color: running ? 'var(--text-muted)' : 'var(--text)',
                fontFamily: 'var(--font-ui)',
                fontWeight: 600,
                cursor: running ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s'
              }}
              onMouseOver={e => { if(!running) e.currentTarget.style.opacity = '0.85'; }}
              onMouseOut={e => { if(!running) e.currentTarget.style.opacity = '1'; }}
            >
              {running ? '⏳ Executing...' : '⚡ Run'}
            </button>
          )}
          <CopyButton text={codeText} />
        </div>
      </div>

      {/* Syntax Highlighting Pre */}
      <div style={{ position: 'relative' }}>
        <SyntaxHighlighter
          style={atomDark}
          language={language}
          PreTag="div"
          customStyle={{ margin: 0, padding: '16px', background: 'transparent' }}
          {...props}
        >
          {codeText}
        </SyntaxHighlighter>
      </div>

      {/* Sandboxed Outputs Drawer */}
      {output !== null && (
        <div style={{
          borderTop: '1px solid var(--border)',
          background: '#06080e',
          animation: 'fadeInUp 0.25s ease'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '6px 16px',
            background: 'rgba(255,255,255,0.02)',
            borderBottom: '1px solid rgba(255,255,255,0.05)'
          }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              OUTPUT CONSOLE
            </span>
            <button
              onClick={() => setOutput(null)}
              style={{
                background: 'transparent', border: 'none',
                color: 'var(--red)', fontSize: '10px',
                fontFamily: 'var(--font-mono)', cursor: 'pointer',
                opacity: 0.8
              }}
              onMouseOver={e => e.currentTarget.style.opacity = 1}
              onMouseOut={e => e.currentTarget.style.opacity = 0.8}
            >
              clear
            </button>
          </div>
          <pre style={{
            margin: 0,
            padding: '12px 16px',
            maxHeight: '180px',
            overflowY: 'auto',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: '#c3e88d',
            lineHeight: '1.5',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
          }}>{output}</pre>
        </div>
      )}
    </div>
  );
}
