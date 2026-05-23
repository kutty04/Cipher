import { API_URL } from '../api';
﻿import { useState, useEffect } from 'react';

export default function WorkspaceExplorer({ onClose }) {
  const [rootPath, setRootPath] = useState('');
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({ '': true }); // Track expanded paths
  const [attachingFile, setAttachingFile] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchTree();
  }, []);

  async function fetchTree(customRoot = '') {
    setLoading(true);
    setErrorMessage('');
    try {
      const url = new URL(`${API_URL}/api/workspace/files`);
      if (customRoot) {
        url.searchParams.append('root', customRoot);
      } else if (rootPath) {
        url.searchParams.append('root', rootPath);
      }
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setTree(data.tree || []);
        setRootPath(data.workspaceRoot);
      } else {
        const err = await res.json();
        setErrorMessage(err.error || 'Failed to load directory');
      }
    } catch (e) {
      setErrorMessage('Could not connect to backend server');
    } finally {
      setLoading(false);
    }
  }

  const toggleExpand = (path) => {
    setExpanded(prev => ({ ...prev, [path]: !prev[path] }));
  };

  async function attachFile(filePath) {
    setAttachingFile(filePath);
    try {
      const url = new URL(`${API_URL}/api/workspace/file`);
      url.searchParams.append('path', filePath);
      if (rootPath) {
        url.searchParams.append('root', rootPath);
      }
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        // Dispatch custom global event to attach file text to prompt
        const event = new CustomEvent('attach-file-content', {
          detail: { path: data.path, content: data.content }
        });
        window.dispatchEvent(event);
      } else {
        console.error('File load failed');
      }
    } catch (e) {
      console.error('Failed to load file contents:', e);
    } finally {
      setAttachingFile(null);
    }
  }

  // Recursive folder renderer
  function renderNode(node) {
    const isDir = node.type === 'directory';
    const isExpanded = expanded[node.path];
    const indent = node.path.split('/').length * 12;

    // Filter search matching
    if (search && !isDir && !node.name.toLowerCase().includes(search.toLowerCase())) {
      return null;
    }

    return (
      <div key={node.path} style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          onClick={() => isDir ? toggleExpand(node.path) : attachFile(node.path)}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '6px 12px 6px ' + (12 + indent) + 'px',
            cursor: 'pointer',
            borderRadius: '6px',
            fontSize: '13px',
            color: isDir ? 'var(--text)' : 'var(--text-dim)',
            gap: '8px',
            userSelect: 'none',
            background: attachingFile === node.path ? 'var(--accent-glow)' : 'transparent',
            transition: 'var(--transition)'
          }}
          className="workspace-item-hover"
        >
          {isDir ? (
            <span style={{ fontSize: '12px', opacity: 0.6, width: '12px' }}>
              {isExpanded ? '▼' : '▶'}
            </span>
          ) : (
            <span style={{ fontSize: '12px', opacity: 0.6, width: '12px' }}>📄</span>
          )}
          
          <span style={{
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            fontWeight: isDir ? 600 : 400
          }}>
            {node.name}
          </span>

          {!isDir && (
            <span
              style={{
                marginLeft: 'auto',
                fontSize: '10px',
                color: 'var(--accent)',
                opacity: 0,
                transition: 'opacity 0.2s',
                fontWeight: 600
              }}
              className="attach-hint"
            >
              {attachingFile === node.path ? 'loading...' : 'Attach ＋'}
            </span>
          )}
        </div>

        {isDir && isExpanded && node.children && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {node.children.map(child => renderNode(child))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{
      width: '100%',
      background: 'var(--bg2)',
      borderRight: '1px solid var(--border)',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      zIndex: 10
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 14px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '15px' }}>📁</span>
          <span style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'var(--font-ui)', color: 'var(--text)' }}>
            Workspace Tree
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', fontSize: '14px'
          }}
        >
          ✕
        </button>
      </div>

      {/* Root Path Selector */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        flexShrink: 0
      }}>
        <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>PROJECT PATH:</label>
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            type="text"
            value={rootPath}
            onChange={(e) => setRootPath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchTree(rootPath)}
            style={{
              flex: 1,
              padding: '6px 8px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              outline: 'none'
            }}
          />
          <button
            onClick={() => fetchTree(rootPath)}
            style={{
              padding: '4px 8px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: '6px',
              color: '#060913',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Go
          </button>
        </div>
      </div>

      {/* Search Filter */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <input
          type="text"
          placeholder="Filter files..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 10px',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            color: 'var(--text)',
            fontSize: '12px',
            fontFamily: 'var(--font-ui)',
            outline: 'none'
          }}
        />
      </div>

      {/* Directory Contents */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '10px 4px'
      }}>
        {errorMessage && (
          <div style={{
            padding: '14px', color: 'var(--red)', fontSize: '11px',
            fontFamily: 'var(--font-mono)', textAlign: 'center'
          }}>
            ⚠️ {errorMessage}
          </div>
        )}

        {loading ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100px', color: 'var(--text-muted)', fontSize: '12px', gap: '8px'
          }}>
            <div style={{
              width: '18px', height: '18px', border: '2px solid var(--accent-glow)',
              borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite'
            }} />
            Scanning folder...
          </div>
        ) : tree.length === 0 && !errorMessage ? (
          <div style={{
            padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px'
          }}>
            Folder is empty.
          </div>
        ) : (
          tree.map(node => renderNode(node))
        )}
      </div>

      {/* Inject styling for child hover states */}
      <style>{" .workspace-item-hover:hover { background: rgba(255, 255, 255, 0.03) !important; } .workspace-item-hover:hover .attach-hint { opacity: 1 !important; } "}</style>
    </div>
  );
}
