import { useState, useRef, useEffect } from 'react';
import Tesseract from 'tesseract.js';
import { isSpeechSupported, createSpeechRecognizer } from '../utils/VoiceAssistant.js';
import CameraModal from './CameraModal.jsx';

const EXAMPLE_PROMPTS = [
  'Why does my useEffect run infinitely?',
  'Debug: TypeError: Cannot read properties of undefined',
  'Explain async/await concepts',
  'Write a function to debounce API calls'
];

// Helper to check text/code extension
function getCodeLanguage(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  const map = {
    js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    py: 'python', html: 'html', css: 'css', json: 'json',
    cpp: 'cpp', c: 'c', java: 'java', go: 'go', rs: 'rust',
    sh: 'bash', md: 'markdown', sql: 'sql'
  };
  return map[ext] || 'text';
}

export default function ChatInput({ onSend, disabled }) {
  const [value, setValue] = useState('');
  const [listening, setListening] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);

  const textareaRef = useRef(null);
  const recognizerRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const handleAttach = (e) => {
      const { path: filePath, content: fileContent } = e.detail;
      const fileName = filePath.split('/').pop() || filePath;
      setAttachedFiles(prev => {
        if (prev.some(f => f.path === filePath)) return prev;
        return [...prev, { name: fileName, content: fileContent, path: filePath }];
      });
    };
    window.addEventListener('attach-file-content', handleAttach);
    return () => window.removeEventListener('attach-file-content', handleAttach);
  }, []);

  useEffect(() => {
    if (isSpeechSupported()) {
      recognizerRef.current = createSpeechRecognizer({
        onResult: (text) => {
          setValue(text);
          adjustTextareaHeight();
        },
        onStart: () => setListening(true),
        onEnd: () => setListening(false),
        onError: (err) => {
          console.error('[Voice STT Error]', err);
          setListening(false);
        }
      });
    }

    return () => {
      if (recognizerRef.current) {
        recognizerRef.current.abort();
      }
    };
  }, []);

  function adjustTextareaHeight() {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    }
  }

  function toggleListen() {
    if (!recognizerRef.current) return;
    if (listening) {
      recognizerRef.current.stop();
    } else {
      recognizerRef.current.start();
    }
  }

  function handleSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed && attachedFiles.length === 0) return;
    if (disabled || ocrProgress) return;

    if (listening && recognizerRef.current) {
      recognizerRef.current.stop();
    }

    let finalPrompt = trimmed;
    if (attachedFiles.length > 0) {
      const fileBlocks = attachedFiles.map(f => {
        const extension = f.name.split('.').pop() || 'txt';
        return '\n\n### File: ' + (f.path || f.name) + '\n```' + extension + '\n' + f.content + '\n```';
      }).join('\n');
      finalPrompt = `${trimmed}\n${fileBlocks}`.trim();
    }

    onSend(finalPrompt);
    setValue('');
    setAttachedFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  function handleInput(e) {
    setValue(e.target.value);
    adjustTextareaHeight();
  }

  // Handle OCR processing for both local file uploads & webcam captures
  async function performOCR(imageFileOrBlob) {
    setOcrProgress('Initializing OCR engine...');
    try {
      const result = await Tesseract.recognize(imageFileOrBlob, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing') {
            setOcrProgress(`Reading text... ${Math.round(m.progress * 100)}%`);
          }
        }
      });
      
      const text = result.data.text.trim();
      if (text) {
        setValue(prev => {
          const prefix = prev ? prev + '\n\n' : '';
          return `${prefix}\`\`\`text\n${text}\n\`\`\``;
        });
        setTimeout(adjustTextareaHeight, 50);
      } else {
        alert('Could not recognize any text in the image.');
      }
    } catch (err) {
      console.error('OCR Processing error:', err);
      alert('OCR analysis failed: ' + err.message);
    } finally {
      setOcrProgress(null);
    }
  }

  // Handle file selectors
  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input value so same file can be selected again
    e.target.value = '';

    const isImage = file.type.startsWith('image/');
    if (isImage) {
      performOCR(file);
    } else {
      // Treat as standard code/text file
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target && evt.target.result;
        if (typeof text === 'string') {
          setAttachedFiles(prev => {
            if (prev.some(f => f.name === file.name)) return prev;
            return [...prev, { name: file.name, content: text, path: file.name }];
          });
        }
      };
      reader.onerror = () => alert('Failed to read file.');
      reader.readAsText(file);
    }
  }

  return (
    <div>
      {/* OCR/Attachment Loading Panel */}
      {ocrProgress && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--accent-glow)',
          border: '1px solid var(--accent)',
          borderRadius: '8px',
          padding: '8px 14px',
          marginBottom: '10px',
          fontSize: '12px',
          fontFamily: 'var(--font-mono)',
          color: 'var(--accent)',
          animation: 'fadeInUp 0.2s ease'
        }}>
          <span style={{
            width: '12px', height: '12px',
            border: '2px solid var(--accent)',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
          <span>🔍 {ocrProgress}</span>
        </div>
      )}

      {/* Attached File Chips */}
      {attachedFiles.length > 0 && (
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'10px',animation:'fadeInUp 0.2s ease'}}>
          {attachedFiles.map((f, i) => (
            <div key={i} style={{display:'flex',alignItems:'center',gap:'6px',background:'var(--accent-glow)',border:'1px solid var(--accent)',borderRadius:'20px',padding:'4px 10px 4px 12px',fontSize:'12px',fontFamily:'var(--font-mono)',color:'var(--accent)',maxWidth:'220px'}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.name}</span>
              <button onClick={()=>setAttachedFiles(prev=>prev.filter((_,j)=>j!==i))} style={{background:'none',border:'none',cursor:'pointer',color:'var(--accent)',fontSize:'16px',lineHeight:1,padding:'0 0 0 2px',flexShrink:0,opacity:0.8}} title="Remove">&times;</button>
            </div>
          ))}
        </div>
      )}
      {/* Example Prompt Chips */}
      {!value && !ocrProgress && (
        <div style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          marginBottom: '14px',
          animation: 'fadeInUp 0.3s ease'
        }}>
          {EXAMPLE_PROMPTS.map((p, i) => (
            <button
              key={i}
              onClick={() => setValue(p)}
              disabled={disabled || !!ocrProgress}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                color: 'var(--text-dim)',
                padding: '6px 12px',
                borderRadius: '16px',
                fontSize: '11px',
                fontWeight: 500,
                cursor: (disabled || ocrProgress) ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-ui)',
                transition: 'var(--transition)',
                whiteSpace: 'nowrap'
              }}
              onMouseOver={e => {
                if (!disabled && !ocrProgress) {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.color = 'var(--accent)';
                  e.currentTarget.style.background = 'var(--accent-glow)';
                }
              }}
              onMouseOut={e => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text-dim)';
                e.currentTarget.style.background = 'var(--bg-card)';
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Attached Files Chips Panel */}
      {attachedFiles.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          marginBottom: '10px',
          animation: 'fadeInUp 0.2s ease'
        }}>
          {attachedFiles.map((file, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--bg-card)',
                border: '1px solid var(--accent)',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text)',
                boxShadow: '0 0 10px var(--accent-glow)'
              }}
            >
              <span>📄</span>
              <span style={{ fontWeight: 600 }}>{file.name}</span>
              <button
                onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== idx))}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--red)',
                  cursor: 'pointer',
                  padding: '0 2px',
                  fontSize: '12px',
                  lineHeight: 1
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Input Textarea Container */}
      <div style={{
        display: 'flex',
        gap: '10px',
        background: 'var(--bg-chat-input)',
        border: `1px solid ${disabled || ocrProgress ? 'var(--border)' : listening ? 'var(--red)' : 'rgba(255, 255, 255, 0.08)'}`,
        borderRadius: '14px',
        padding: '10px 12px 10px 14px',
        transition: 'var(--transition)',
        alignItems: 'flex-end',
        boxShadow: listening ? '0 0 15px rgba(255, 0, 127, 0.15)' : '0 4px 20px rgba(0, 0, 0, 0.15)'
      }}
      onFocus={e => { if(!disabled && !listening && !ocrProgress) e.currentTarget.style.borderColor = 'var(--accent)'; }}
      onBlur={e => { if(!listening && !ocrProgress) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'; }}
      >
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*,text/*,.js,.jsx,.ts,.tsx,.py,.html,.css,.json,.md,.sql,.rs,.go,.java,.cpp,.c"
          style={{ display: 'none' }}
          disabled={disabled || !!ocrProgress}
        />

        {/* Attachment Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || !!ocrProgress}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: disabled || ocrProgress ? 'not-allowed' : 'pointer',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6px 4px',
            flexShrink: 0,
            transition: 'var(--transition)'
          }}
          onMouseOver={e => { if(!disabled && !ocrProgress) e.currentTarget.style.color = 'var(--text)'; }}
          onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
          title="Attach text file, code block, or screenshot"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
          </svg>
        </button>

        {/* Camera Snap Button */}
        <button
          onClick={() => setCameraOpen(true)}
          disabled={disabled || !!ocrProgress}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: disabled || ocrProgress ? 'not-allowed' : 'pointer',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6px 4px',
            flexShrink: 0,
            transition: 'var(--transition)'
          }}
          onMouseOver={e => { if(!disabled && !ocrProgress) e.currentTarget.style.color = 'var(--text)'; }}
          onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
          title="Scan code from physical sheet or screen using webcam"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
            <circle cx="12" cy="13" r="4"></circle>
          </svg>
        </button>

        {/* Voice Dictation (Mic Button) */}
        {isSpeechSupported() && (
          <button
            onClick={toggleListen}
            disabled={disabled || !!ocrProgress}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: disabled || ocrProgress ? 'not-allowed' : 'pointer',
              color: listening ? 'var(--red)' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px 4px',
              flexShrink: 0,
              transition: 'var(--transition)'
            }}
            onMouseOver={e => { if(!disabled && !ocrProgress && !listening) e.currentTarget.style.color = 'var(--text)'; }}
            onMouseOut={e => { if(!listening) e.currentTarget.style.color = 'var(--text-muted)'; }}
            title="Voice dictate your prompt"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill={listening ? 'var(--red)' : 'none'} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: listening ? 'pulse 1.2s infinite' : 'none' }}>
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
              <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
          </button>
        )}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={ocrProgress ? "Extracting text... please wait" : listening ? "Listening... Speak clearly." : "Ask a question or paste code details..."}
          disabled={disabled || !!ocrProgress}
          rows={1}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: disabled || ocrProgress ? 'var(--text-muted)' : 'var(--text)',
            fontSize: '14px',
            fontFamily: 'var(--font-ui)',
            resize: 'none',
            lineHeight: '1.6',
            minHeight: '26px',
            cursor: disabled || ocrProgress ? 'not-allowed' : 'text'
          }}
        />

        <button
          onClick={handleSubmit}
          disabled={(!value.trim() && attachedFiles.length === 0) || disabled || !!ocrProgress}
          style={{
            width: '36px', height: '36px',
            background: ((!value.trim() && attachedFiles.length === 0) || disabled || ocrProgress) ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg, var(--accent), var(--accent-purple))',
            border: 'none',
            borderRadius: '10px',
            cursor: (!value.trim() || disabled || ocrProgress) ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'var(--transition)',
            flexShrink: 0,
            boxShadow: ((!value.trim() && attachedFiles.length === 0) || disabled || ocrProgress) ? 'none' : '0 2px 10px rgba(0, 242, 254, 0.15)'
          }}
          onMouseDown={e => {
            if (!((!value.trim() && attachedFiles.length === 0) || disabled || ocrProgress)) e.currentTarget.style.transform = 'scale(0.92)';
          }}
          onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={((!value.trim() && attachedFiles.length === 0) || disabled || ocrProgress) ? 'var(--text-muted)' : '#060913'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>

      <div style={{
        textAlign: 'center',
        marginTop: '8px',
        fontSize: '10px',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono)',
        letterSpacing: '0.5px'
      }}>
        Press Enter to Send · Shift + Enter for Newline
      </div>

      {/* Camera Dialog Overlay */}
      {cameraOpen && (
        <CameraModal
          onCapture={performOCR}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </div>
  );
}

