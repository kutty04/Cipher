import { useState, useEffect, useRef } from 'react';

export default function ArtifactPreview({ code, language, onClose }) {
  const [activeTab, setActiveTab] = useState('preview'); // 'preview' | 'code'
  const [iframeErrors, setIframeErrors] = useState([]);
  const iframeRef = useRef(null);

  const isHtml = language === 'html';
  const isReact = language === 'jsx' || language === 'react' || (language === 'js' && code.includes('import React'));

  useEffect(() => {
    if (activeTab !== 'preview' || !iframeRef.current) return;

    const iframe = iframeRef.current;
    setIframeErrors([]);

    // Channel name to capture runtime errors inside the iframe
    const channelName = `artifact_err_${Math.random().toString(36).substr(2, 9)}`;
    window[channelName] = (message) => {
      setIframeErrors(prev => [...prev, message]);
    };

    let docHtml = '';

    if (isHtml) {
      docHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            body { font-family: system-ui, sans-serif; background: #0b0f19; color: #f3f4f6; padding: 20px; }
          </style>
          <script>
            window.onerror = (msg, src, line) => {
              window.parent['${channelName}']("Error: " + msg + " (line " + line + ")");
              return true;
            };
          </script>
        </head>
        <body>
          ${code}
        </body>
        </html>
      `;
    } else {
      // Build React / JSX runner
      docHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
          <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
          <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            body { font-family: system-ui, sans-serif; background: #0b0f19; color: #f3f4f6; margin: 0; padding: 20px; }
          </style>
          <script>
            window.onerror = (msg, src, line) => {
              window.parent['${channelName}']("Runtime Error: " + msg + " (line " + line + ")");
              return true;
            };
          </script>
        </head>
        <body>
          <div id="root"></div>
          
          <script type="text/babel">
            // Expose standard icons and libraries
            try {
              ${code}
              
              // Find the default component or App component, else mount top-level
              const ComponentToMount = typeof App !== 'undefined' ? App : (typeof Main !== 'undefined' ? Main : null);
              if (ComponentToMount) {
                const root = ReactDOM.createRoot(document.getElementById('root'));
                root.render(<ComponentToMount />);
              } else {
                // If it is not a React component, render a beautiful status page
                const root = ReactDOM.createRoot(document.getElementById('root'));
                root.render(
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100vh',
                    textAlign: 'center',
                    padding: '20px',
                    boxSizing: 'border-box'
                  }}>
                    <div style={{
                      background: 'rgba(0, 242, 254, 0.03)',
                      border: '1px solid rgba(0, 242, 254, 0.15)',
                      borderRadius: '16px',
                      padding: '32px',
                      maxWidth: '400px',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
                    }}>
                      <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚡</div>
                      <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 10px 0', color: '#00f2fe' }}>
                        Vanilla Script Loaded
                      </h3>
                      <p style={{ fontSize: '13px', color: '#9ca3af', lineHeight: '1.6', margin: '0 0 20px 0' }}>
                        This script executed successfully. Since it does not export an App or Main component, you can view the source code in the <strong>Code</strong> tab.
                      </p>
                      <div style={{
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        background: '#060913',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.05)',
                        color: '#c3e88d',
                        textAlign: 'left'
                      }}>
                        Status: Active / Running
                      </div>
                    </div>
                  </div>
                );
              }
            } catch (err) {
              window.parent['${channelName}']("Transpilation/Mount Error: " + err.message);
            }

            // Manually dispatch DOMContentLoaded in case the script wraps its code in a listener
            setTimeout(() => {
              window.dispatchEvent(new Event('DOMContentLoaded'));
            }, 100);
          </script>
        </body>
        </html>
      `;
    }

    iframe.srcdoc = docHtml;

    return () => {
      delete window[channelName];
    };
  }, [code, language, activeTab, isHtml, isReact]);

  return (
    <div style={{
      width: '45%',
      height: '100%',
      background: 'var(--bg2)',
      borderLeft: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      animation: 'slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      flexShrink: 0,
      position: 'relative'
    }}>
      {/* Panel Controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 18px',
        borderBottom: '1px solid var(--border)',
        background: 'rgba(6,9,19,0.3)',
        backdropFilter: 'blur(10px)',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.02)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <button
            onClick={() => setActiveTab('preview')}
            style={{
              padding: '6px 14px', border: 'none', borderRadius: '6px',
              fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: '12px',
              cursor: 'pointer',
              background: activeTab === 'preview' ? 'var(--accent)' : 'transparent',
              color: activeTab === 'preview' ? '#060913' : 'var(--text-dim)',
              transition: 'var(--transition)'
            }}
          >
            Preview
          </button>
          <button
            onClick={() => setActiveTab('code')}
            style={{
              padding: '6px 14px', border: 'none', borderRadius: '6px',
              fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: '12px',
              cursor: 'pointer',
              background: activeTab === 'code' ? 'var(--accent)' : 'transparent',
              color: activeTab === 'code' ? '#060913' : 'var(--text-dim)',
              transition: 'var(--transition)'
            }}
          >
            Code
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            fontSize: '11px', color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)', fontWeight: 700,
            background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: '4px'
          }}>
            {language?.toUpperCase() || 'SANDBOX'}
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '4px', transition: 'var(--transition)'
            }}
            onMouseOver={e => e.currentTarget.style.color = 'var(--text)'}
            onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      {/* Frame Rendering Container */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#0b0f19' }}>
        {activeTab === 'preview' ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <iframe
              ref={iframeRef}
              title="Artifact Output"
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                background: '#0b0f19'
              }}
            />

            {/* If we have runtime or transpilation logs/errors, render a micro debug console */}
            {iframeErrors.length > 0 && (
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                maxHeight: '150px', overflowY: 'auto',
                background: 'rgba(255, 0, 127, 0.08)',
                borderTop: '1px solid var(--red)',
                padding: '12px 18px',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                color: 'var(--red)',
                zIndex: 20
              }}>
                <div style={{ fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', marginBottom: '4px', opacity: 0.8 }}>
                  🔧 RUNTIME ISSUES DETECTED
                </div>
                {iframeErrors.map((err, idx) => (
                  <div key={idx}>{err}</div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <pre style={{
            margin: 0,
            padding: '24px',
            height: '100%',
            overflowY: 'auto',
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            color: '#c3e88d',
            lineHeight: '1.6',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
          }}>
            {code}
          </pre>
        )}
      </div>
    </div>
  );
}
