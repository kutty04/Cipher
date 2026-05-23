import { useState, useRef, useEffect, useCallback } from 'react';
import { streamToAgent, checkHealth, getSessions, getSessionMessages } from './api.js';
import ChatInput from './components/ChatInput.jsx';
import Message from './components/Message.jsx';
import LoadingIndicator from './components/LoadingIndicator.jsx';
import ArtifactPreview from './components/ArtifactPreview.jsx';
import WorkspaceExplorer from './components/WorkspaceExplorer.jsx';
import ApiStatusModal from './components/ApiStatusModal.jsx';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [backendOnline, setBackendOnline] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [activeArtifact, setActiveArtifact] = useState(null);
  const [theme, setTheme] = useState(localStorage.getItem('agent-theme') || 'obsidian');
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [apiStatusOpen, setApiStatusOpen] = useState(false);
  const [fallbackNotification, setFallbackNotification] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('agent-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (fallbackNotification) {
      const t = setTimeout(() => setFallbackNotification(null), 6000);
      return () => clearTimeout(t);
    }
  }, [fallbackNotification]);
  
  const messagesEndRef = useRef(null);
  const cancelStreamRef = useRef(null);

  useEffect(() => {
    checkHealth().then(ok => setBackendOnline(ok));
    loadSessions();
  }, []);

  // Listen to open-artifact requests from code blocks
  useEffect(() => {
    const handleOpenArtifact = (e) => {
      setActiveArtifact({
        code: e.detail.code,
        language: e.detail.language
      });
    };
    window.addEventListener('open-artifact', handleOpenArtifact);
    return () => window.removeEventListener('open-artifact', handleOpenArtifact);
  }, []);

  async function loadSessions() {
    try {
      const data = await getSessions();
      setSessions(data);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = useCallback((text) => {
    if (cancelStreamRef.current) cancelStreamRef.current();

    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    const agentMsgIndex = messages.length + 1;
    setMessages(prev => [...prev, { role: 'agent', content: '', thinking: [], isStreaming: true }]);

    const thinkingAccum = [];
    let currentSessionId = sessionId;

    const cancel = streamToAgent(text, sessionId, {
      onSession: ({ sessionId: sid }) => {
        currentSessionId = sid;
        if (!sessionId) {
          setSessionId(sid);
          loadSessions();
        }
      },
      onThinking: (step) => {
        thinkingAccum.push(step);
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === 'agent') {
            updated[updated.length - 1] = { ...last, thinking: [...thinkingAccum] };
          }
          return updated;
        });
      },
      onToken: (token) => {
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === 'agent') {
            updated[updated.length - 1] = { ...last, content: last.content + token };
          }
          return updated;
        });
      },
      onFallback: (event) => {
        setFallbackNotification(event);
      },
      onDone: ({ durationMs, model }) => {
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === 'agent') {
            updated[updated.length - 1] = {
              ...last,
              isStreaming: false,
              duration: durationMs,
              model
            };
          }
          return updated;
        });
        setLoading(false);
        loadSessions();
      },
      onError: (msg) => {
        setMessages(prev => {
          const updated = [...prev];
          if (updated[updated.length - 1]?.isStreaming) {
            updated[updated.length - 1] = { role: 'error', content: msg };
          } else {
            updated.push({ role: 'error', content: msg });
          }
          return updated;
        });
        setLoading(false);
      }
    });

    cancelStreamRef.current = cancel;
  }, [sessionId, messages.length]);

  async function loadSessionHistory(id) {
    if (cancelStreamRef.current) cancelStreamRef.current();
    setLoading(true);
    setActiveArtifact(null);
    setSidebarOpen(false); // Clear active artifact on session switch
    try {
      const sessionData = await getSessionMessages(id);
      setSessionId(sessionData.id);
      const formatted = sessionData.messages.map(m => ({
        role: m.role,
        content: m.content,
        model: m.model,
        thinking: m.thinking ? JSON.parse(m.thinking) : null
      }));
      setMessages(formatted);
    } catch (error) {
      console.error('Failed to load history', error);
    } finally {
      setLoading(false);
    }
  }

  function startNewChat() {
    if (cancelStreamRef.current) cancelStreamRef.current();
    setSessionId(null);
    setMessages([]);
    setActiveArtifact(null);
    setSidebarOpen(false);
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'row', background: 'var(--bg)', position: 'relative' }}>

      {/* Mobile sidebar overlay backdrop */}
      <div
        className={"sidebar-overlay" + (sidebarOpen ? " visible" : "")}
        onClick={() => setSidebarOpen(false)}
        style={{ display: 'none' }}
      />

      {/* Workspace File tree panel */}
      {workspaceOpen && (
        <div className="workspace-panel"><WorkspaceExplorer onClose={() => { setWorkspaceOpen(false); }} /></div>
      )}
      
      {/* -- Sidebar -- */}
      <div className={"sidebar" + (sidebarOpen ? " open" : "") + (sidebarCollapsed ? " collapsed" : "")} style={{
        width: sidebarCollapsed ? '0' : '260px',
        minWidth: sidebarCollapsed ? '0' : '260px',
        borderRight: sidebarCollapsed ? 'none' : '1px solid var(--border)',
        background: 'var(--bg-sidebar)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        zIndex: 10
      }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--border)' }}>
          <button
            onClick={startNewChat}
            className="premium-glow-hover"
            style={{
              width: '100%', padding: '12px',
              background: 'linear-gradient(135deg, var(--accent), var(--accent-purple))',
              color: '#060913',
              border: 'none', borderRadius: '10px',
              fontFamily: 'var(--font-ui)', fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', gap: '8px',
              boxShadow: '0 4px 15px rgba(0, 242, 254, 0.2)'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            New Chat
          </button>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px' }}>
          <div style={{
            fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)',
            marginBottom: '16px', paddingLeft: '8px', letterSpacing: '1.5px',
            textTransform: 'uppercase'
          }}>
            History
          </div>
          {sessions.length === 0 && (
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', paddingLeft: '8px', fontStyle: 'italic' }}>
              No chats yet
            </div>
          )}
          {sessions.map(s => (
            <div
              key={s.id}
              onClick={() => loadSessionHistory(s.id)}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                marginBottom: '6px',
                cursor: 'pointer',
                background: sessionId === s.id ? 'var(--accent-glow)' : 'transparent',
                color: sessionId === s.id ? 'var(--accent)' : 'var(--text-dim)',
                border: `1px solid ${sessionId === s.id ? 'rgba(0, 242, 254, 0.2)' : 'transparent'}`,
                fontSize: '13.5px',
                fontFamily: 'var(--font-ui)',
                fontWeight: sessionId === s.id ? 600 : 400,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'var(--transition)'
              }}
              onMouseOver={e => { if (sessionId !== s.id) { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = 'var(--text)'; } }}
              onMouseOut={e => { if (sessionId !== s.id) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)'; } }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.7 }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{s.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* -- Main Area -- */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, zIndex: 5 }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-header)', backdropFilter: 'blur(12px)',
          flexShrink: 0
        }}>
          <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Sidebar Toggle Button - visible on all sizes */}
            <button
              className="sidebar-toggle-btn"
              onClick={() => { setSidebarCollapsed(prev => !prev); setSidebarOpen(false); }}
              title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '34px', height: '34px',
                background: sidebarCollapsed ? 'var(--accent-glow)' : 'transparent',
                border: '1px solid ' + (sidebarCollapsed ? 'var(--accent)' : 'var(--border)'),
                borderRadius: '8px',
                color: sidebarCollapsed ? 'var(--accent)' : 'var(--text-dim)',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'var(--transition)'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {sidebarCollapsed
                  ? <><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><polyline points="14 8 18 12 14 16"/></>  
                  : <><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><polyline points="14 16 10 12 14 8"/></>
                }
              </svg>
            </button>
            {/* Hamburger menu - mobile only */}
            <button
              className="hamburger-btn"
              onClick={() => setSidebarOpen(prev => !prev)}
              style={{
                display: 'none',
                alignItems: 'center',
                justifyContent: 'center',
                width: '34px', height: '34px',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--text)',
                cursor: 'pointer',
                fontSize: '18px',
                flexShrink: 0
              }}
            >
              {sidebarOpen ? '?' : '?'}
            </button>
            <div className="app-icon" style={{
              width: '38px', height: '38px',
              background: 'linear-gradient(135deg, var(--accent-glow), var(--accent-purple-glow))',
              border: '1px solid var(--accent)',
              borderRadius: '10px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', boxShadow: '0 0 15px var(--accent-glow)'
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6"></polyline>
                <polyline points="8 6 2 12 8 18"></polyline>
              </svg>
            </div>
            <div>
              <div className="app-title" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-ui)', letterSpacing: '-0.3px' }}>
                Cipher
              </div>
              <div className="app-subtitle" style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                llama-3.3-70b-versatile · debug · explain · fix · <span style={{ color: 'var(--accent)', animation: 'pulse 1.5s infinite' }}>⚡ streaming</span>
              </div>
            </div>
          </div>

          <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: activeArtifact ? '6px' : '12px' }}>
            {/* Theme Customizer Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {!activeArtifact && (
                <span className="theme-label" style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>THEME:</span>
              )}
              <select
                className="theme-select"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '20px',
                  color: 'var(--text)',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  padding: '4px 8px',
                  outline: 'none',
                  cursor: 'pointer',
                  maxWidth: activeArtifact ? '85px' : 'none',
                  textOverflow: 'ellipsis'
                }}
              >
                <option value="obsidian">Slate Obsidian 🌚</option>
                <option value="coquette">Coquette Core 🌸</option>
                <option value="synthwave">Synthwave Neon 🌊</option>
                <option value="matrix">Matrix Green 🟢</option>
              </select>
            </div>

            {/* Workspace Explorer Button */}
            <button
              className="workspace-btn"
              onClick={() => setWorkspaceOpen(prev => !prev)}
              title="Workspace Explorer"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 600,
                background: workspaceOpen ? 'var(--accent-glow)' : 'rgba(255, 255, 255, 0.02)',
                border: '1px solid ' + (workspaceOpen ? 'var(--accent)' : 'var(--border)'),
                padding: '4px 12px', borderRadius: '20px', color: workspaceOpen ? 'var(--accent)' : 'var(--text)',
                cursor: 'pointer', transition: 'var(--transition)'
              }}
            >
              🗂️ {!activeArtifact && <span className="workspace-btn-text">WORKSPACE</span>}
            </button>

            {/* API Status Button */}
            <button
              onClick={() => setApiStatusOpen(true)}
              title="API Connection Status Dashboard"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 600,
                background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border)',
                padding: '4px 12px', borderRadius: '20px', color: 'var(--text)',
                cursor: 'pointer', transition: 'var(--transition)'
              }}
            >
              🟢 {!activeArtifact && <span className="api-status-btn-text">API STATUS</span>}
            </button>

            {/* Connection status pill */}
            <div className="connection-pill" style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              fontSize: '11px', fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              background: 'rgba(255, 255, 255, 0.02)',
              padding: activeArtifact ? '4px 8px' : '4px 10px',
              borderRadius: '20px',
              border: '1px solid var(--border)',
              color: backendOnline === null ? 'var(--text-muted)' : backendOnline ? 'var(--green)' : 'var(--red)'
            }}
            title={backendOnline === null ? 'Connecting to backend...' : backendOnline ? 'Backend Online' : 'Backend Offline'}
            >
              <div style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: backendOnline === null ? 'var(--text-muted)' : backendOnline ? 'var(--green)' : 'var(--red)',
                animation: backendOnline ? 'pulse 1.5s infinite' : 'none'
              }} />
              {!activeArtifact && (backendOnline === null ? 'CONNECTING' : backendOnline ? 'ONLINE' : 'OFFLINE')}
            </div>
          </div>
        </div>

        {/* Messages Container */}
        <div className="messages-container" style={{ flex: 1, overflowY: 'auto', padding: '32px 24px', paddingBottom: '60px' }}>
          {messages.length === 0 && !loading && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '100%', gap: '16px',
              animation: 'fadeInUp 0.5s ease'
            }}>
              <div style={{
                width: '64px', height: '64px',
                borderRadius: '50%', background: 'var(--accent-glow)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid var(--accent)', boxShadow: '0 0 25px var(--accent-glow)',
                marginBottom: '10px'
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                  <polyline points="2 17 12 22 22 17"></polyline>
                  <polyline points="2 12 12 17 22 12"></polyline>
                </svg>
              </div>
              <div className="welcome-title" style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-ui)', letterSpacing: '-0.5px' }}>
                How can I build with you today?
              </div>
              <div className="welcome-subtitle" style={{ fontSize: '14.5px', color: 'var(--text-dim)', textAlign: 'center', maxWidth: '420px', lineHeight: '1.7' }}>
                Ask coding questions, trace error logs, or paste code templates. I'll sandbox-test solutions and search docs live.
              </div>
              <div className="welcome-badges" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '16px', maxWidth: '500px' }}>
                {['⚡ Run JS Sandbox', '🔍 Tavily Web Docs', '💾 Auto-Caching', '📋 Clipboard Copy', '🛡️ Safe Execution'].map((cap, i) => (
                  <span key={i} style={{
                    padding: '6px 14px', background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border)', borderRadius: '20px',
                    fontSize: '12px', color: 'var(--text-dim)', fontFamily: 'var(--font-ui)',
                    fontWeight: 500
                  }}>{cap}</span>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => <Message key={i} msg={msg} />)}
          {loading && messages[messages.length - 1]?.role !== 'agent' && <LoadingIndicator />}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input Area */}
        <div className="chat-input-container" style={{
          borderTop: '1px solid var(--border)',
          padding: '20px 24px',
          background: 'var(--bg-input-panel)',
          backdropFilter: 'blur(16px)',
          flexShrink: 0
        }}>
          <ChatInput onSend={handleSend} disabled={loading} />
        </div>
      </div>

      {/* -- Collapsible Artifact Preview Panel -- */}
      {activeArtifact && (
        <ArtifactPreview
          code={activeArtifact.code}
          language={activeArtifact.language}
          onClose={() => setActiveArtifact(null)}
        />
      )}

    
      {/* API Status Dashboard Overlay */}
      {apiStatusOpen && (
        <ApiStatusModal onClose={() => setApiStatusOpen(false)} />
      )}

      {/* Real-time Fallback Notification Banner */}
      {fallbackNotification && (
        <div className="fallback-banner" style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: 'var(--bg3)',
          border: '2px solid var(--accent)',
          boxShadow: '0 0 30px var(--accent-glow)',
          borderRadius: '12px',
          padding: '14px 20px',
          color: 'var(--text)',
          zIndex: 9999,
          fontSize: '13.5px',
          fontFamily: 'var(--font-ui)',
          fontWeight: 700,
          animation: 'slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>⚡ API rate limit fallback!</span>
          </div>
          <div style={{ fontSize: '11px', fontWeight: 400, opacity: 0.9, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
            Switched from {fallbackNotification.from.toUpperCase()} to {fallbackNotification.to.toUpperCase()}
          </div>
        </div>
      )}
  </div>
  );
}

