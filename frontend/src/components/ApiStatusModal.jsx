import { API_URL } from '../api';
﻿import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function ApiStatusModal({ onClose }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatus();
    // Poll health status every 3.5 seconds
    const interval = setInterval(fetchStatus, 3500);
    return () => clearInterval(interval);
  }, []);

  async function fetchStatus() {
    try {
      const res = await fetch(`${API_URL}/api/agent/status`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (e) {
      console.error('Failed to load API statuses:', e);
    } finally {
      setLoading(false);
    }
  }

  const getStatusColor = (state) => {
    switch (state) {
      case 'active': return 'var(--green)';
      case 'online': return 'var(--blue)';
      case 'error': return 'var(--red)';
      default: return 'var(--text-muted)';
    }
  };

  const modalContent = (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(3, 5, 10, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2500,
      padding: '24px',
      boxSizing: 'border-box'
    }}>
      <div style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
        width: '100%',
        maxWidth: '520px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>🟢</span>
            <span style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'var(--font-ui)', color: 'var(--text)' }}>
              API Status & Fallback Monitor
            </span>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none',
            color: 'var(--text-muted)', cursor: 'pointer', fontSize: '20px',
            lineHeight: 1, padding: '2px 6px'
          }}>&times;</button>
        </div>

        {loading ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '200px', color: 'var(--text-muted)', fontSize: '13px'
          }}>Connecting to backend...</div>
        ) : !status ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '200px', color: 'var(--red)', fontSize: '13px'
          }}>⚠️ Could not reach backend status endpoint.</div>
        ) : (
          <>
            {/* API Providers Grid */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px',
              marginBottom: '24px'
            }}>
              {Object.entries(status.providers).map(([id, provider]) => (
                <div key={id} style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700 }}>{provider.name}</span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      fontSize: '11px', fontWeight: 700, color: getStatusColor(provider.status),
                      textTransform: 'uppercase'
                    }}>
                      <span style={{
                        width: '7px', height: '7px', borderRadius: '50%',
                        background: getStatusColor(provider.status),
                        animation: provider.status === 'active' ? 'pulse 1.5s infinite' : 'none'
                      }} />
                      {provider.status}
                    </span>
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {provider.model}
                  </span>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', fontSize: '11px',
                    color: 'var(--text-dim)', marginTop: '8px', paddingTop: '8px',
                    borderTop: '1px dashed var(--border)'
                  }}>
                    <span>Reqs: {provider.queries}</span>
                    <span>Errs: {provider.errors}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Cache Hits info */}
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '12px 16px',
              display: 'flex', justifyContent: 'space-around',
              marginBottom: '20px',
              fontSize: '13px'
            }}>
              <div>⚡ Prompt Cache Hits: <strong style={{ color: 'var(--green)' }}>{status.cacheHits.prompt}</strong></div>
              <div style={{ width: '1px', background: 'var(--border)' }} />
              <div>🔍 Search Cache Hits: <strong style={{ color: 'var(--green)' }}>{status.cacheHits.search}</strong></div>
            </div>

            {/* Fallback Logs */}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <span style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-dim)' }}>
                Fallback History logs
              </span>
              <div style={{
                background: '#040710',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '12px',
                height: '140px',
                overflowY: 'auto',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                {status.fallbacks.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '45px' }}>
                    No fallback events recorded yet. Ready to rotate!
                  </div>
                ) : (
                  status.fallbacks.map((f, i) => (
                    <div key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>[{new Date(f.time).toLocaleTimeString()}]</span>{' '}
                      <strong style={{ color: 'var(--red)' }}>{f.from.toUpperCase()}</strong>{' '}
                      ➔ <strong style={{ color: 'var(--green)' }}>{f.to.toUpperCase()}</strong>
                      <div style={{ color: 'var(--yellow)', opacity: 0.85, marginTop: '2px', paddingLeft: '8px' }}>
                        Reason: {f.reason}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
