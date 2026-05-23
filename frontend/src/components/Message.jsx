import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import ThinkingLog from './ThinkingLog.jsx';
import DiffView from './DiffView.jsx';
import CodeBlockWrapper from './CodeBlockWrapper.jsx';
import { speakText, stopSpeaking } from '../utils/VoiceAssistant.js';

function StreamingCursor() {
  return (
    <span style={{
      display: 'inline-block',
      width: '2px',
      height: '1em',
      background: 'var(--accent)',
      marginLeft: '2px',
      verticalAlign: 'text-bottom',
      animation: 'blink 0.8s step-end infinite',
      borderRadius: '1px'
    }} />
  );
}

export default function Message({ msg }) {
  const isUser = msg.role === 'user';
  const isError = msg.role === 'error';
  const isStreaming = msg.isStreaming === true;
  const [speaking, setSpeaking] = useState(false);

  // Stop speaking if component unmounts
  useEffect(() => {
    return () => {
      if (speaking) stopSpeaking();
    };
  }, [speaking]);

  function handleSpeakToggle() {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
    } else {
      setSpeaking(true);
      speakText(msg.content, {
        onStart: () => setSpeaking(true),
        onEnd: () => setSpeaking(false),
        onError: () => setSpeaking(false)
      });
    }
  }

  const renderCompare = (text) => {
    if (typeof text !== 'string') return [{ type: 'text', content: text }];

    const compareRegex = /<compare>([\s\S]*?)<\/compare>/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = compareRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
      }

      const innerContent = match[1].trim();
      let oldCode = '';
      let newCode = '';

      const oldMatch = /<old>([\s\S]*?)<\/old>/.exec(innerContent);
      const newMatch = /<new>([\s\S]*?)<\/new>/.exec(innerContent);

      if (oldMatch || newMatch) {
        oldCode = oldMatch ? oldMatch[1].trim() : '';
        newCode = newMatch ? newMatch[1].trim() : '';
      } else {
        const splitParts = innerContent.split(/[=-]{3,}/);
        oldCode = splitParts[0]?.trim() || '';
        newCode = splitParts[1]?.trim() || '';
      }

      parts.push({ type: 'compare', oldCode, newCode });
      lastIndex = compareRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push({ type: 'text', content: text.slice(lastIndex) });
    }

    return parts;
  };

  const renderContent = (content) => {
    if (!content) return isStreaming ? <StreamingCursor /> : null;

    const items = renderCompare(content);

    return items.map((item, i) => {
      if (item.type === 'compare') {
        return <DiffView key={i} oldCode={item.oldCode} newCode={item.newCode} />;
      }

      const sections = item.content.split(/(?=🚨 ROOT CAUSE:|✅ THE FIX:|🧠 HOW IT WORKS \(ELI5\):|💡 PRO-TIP:)/g);

      return sections.map((section, idx) => {
        let icon = null;
        let title = null;
        let body = section;

        if (section.startsWith('🚨 ROOT CAUSE:')) {
          icon = '🚨'; title = 'ROOT CAUSE'; body = section.replace('🚨 ROOT CAUSE:', '').trim();
        } else if (section.startsWith('✅ THE FIX:')) {
          icon = '✅'; title = 'THE FIX'; body = section.replace('✅ THE FIX:', '').trim();
        } else if (section.startsWith('🧠 HOW IT WORKS (ELI5):')) {
          icon = '🧠'; title = 'HOW IT WORKS (ELI5)'; body = section.replace('🧠 HOW IT WORKS (ELI5):', '').trim();
        } else if (section.startsWith('💡 PRO-TIP:')) {
          icon = '💡'; title = 'PRO-TIP'; body = section.replace('💡 PRO-TIP:', '').trim();
        }

        const isLastSection = i === items.length - 1 && idx === sections.length - 1;

        return (
          <div key={`${i}-${idx}`} style={{
            marginBottom: title ? '24px' : '0',
            background: title ? 'var(--bg3)' : 'transparent',
            padding: title ? '16px' : '0',
            borderRadius: title ? '12px' : '0',
            border: title ? '1px solid var(--border)' : 'none',
            animation: 'fadeInUp 0.3s ease'
          }}>
            {title && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                fontSize: '12px', fontWeight: 700, color: 'var(--accent)',
                marginBottom: '12px', letterSpacing: '1px', fontFamily: 'var(--font-ui)'
              }}>
                <span>{icon}</span> {title}
              </div>
            )}
            <ReactMarkdown
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const isBlock = match || (typeof children === 'string' && children.includes('\n'));
                  return isBlock && match ? (
                    <CodeBlockWrapper language={match[1]} {...props}>
                      {children}
                    </CodeBlockWrapper>
                  ) : (
                    <code className={className} {...props}>{children}</code>
                  );
                }
              }}
            >
              {body}
            </ReactMarkdown>
            {isStreaming && isLastSection && <StreamingCursor />}
          </div>
        );
      });
    });
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      marginBottom: '32px',
      gap: '8px',
      width: '100%'
    }}>
      <div style={{
        fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: '8px'
      }}>
        {isUser ? 'YOU' : 'AGENT'}
        
        {!isUser && !isError && msg.model && (
          <span style={{ color: 'var(--accent)', opacity: 0.8 }}>· {msg.model}</span>
        )}

        {/* Speaker TTS Toggle */}
        {!isUser && !isError && msg.content && (
          <button
            onClick={handleSpeakToggle}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: speaking ? 'var(--accent)' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2px',
              transition: 'var(--transition)'
            }}
            title={speaking ? "Stop voice" : "Read response aloud"}
          >
            {speaking ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'pulse 1s infinite' }}>
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              </svg>
            )}
          </button>
        )}

        {isStreaming && (
          <span style={{
            fontSize: '10px', color: 'var(--accent)',
            background: 'var(--accent-glow)', padding: '1px 6px',
            borderRadius: '4px', animation: 'pulse 1.5s infinite'
          }}>
            ⚡ streaming
          </span>
        )}
      </div>

      <div style={{
        maxWidth: '85%',
        padding: isUser ? '12px 18px' : '0',
        borderRadius: '16px',
        background: isUser ? 'var(--accent-glow)' : 'transparent',
        border: isUser ? '1px solid var(--accent)' : 'none',
        color: isUser ? 'var(--text)' : 'var(--text-dim)',
        lineHeight: '1.6',
        fontSize: '15px'
      }}>
        {!isUser && !isError && msg.thinking && msg.thinking.length > 0 && (
          <ThinkingLog
            steps={msg.thinking}
            iterations={msg.iterations}
            duration={msg.duration}
          />
        )}

        <div className="markdown-body" style={{ color: isUser ? 'var(--text)' : 'var(--text-dim)' }}>
          {isError ? (
            <div style={{
              color: 'var(--red)',
              background: 'rgba(255, 107, 107, 0.1)',
              padding: '12px', borderRadius: '8px',
              border: '1px solid var(--red)'
            }}>
              ⚠️ {msg.content}
            </div>
          ) : isUser ? (
            <ReactMarkdown
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const isBlock = match || (typeof children === 'string' && children.includes('\n'));
                  return isBlock && match ? (
                    <CodeBlockWrapper language={match[1]} {...props}>
                      {children}
                    </CodeBlockWrapper>
                  ) : (
                    <code className={className} {...props}>{children}</code>
                  );
                }
              }}
            >
              {msg.content}
            </ReactMarkdown>
          ) : (
            renderContent(msg.content)
          )}
        </div>
      </div>
    </div>
  );
}
