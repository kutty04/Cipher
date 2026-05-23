import { useState } from 'react';

// Icons and colors per tool type
const TOOL_ICONS = {
  run_code: '⚡',
  analyze_error: '🔍',
  explain_code: '📖',
  generate_fix: '🔧',
  search_docs: '📚',
};

const TOOL_COLORS = {
  run_code: 'var(--yellow)',
  analyze_error: 'var(--red)',
  explain_code: 'var(--blue)',
  generate_fix: 'var(--green)',
  search_docs: 'var(--accent)',
};

export default function ThinkingLog({ steps, iterations, duration }) {
  const [expanded, setExpanded] = useState(false);
  const [expandedStep, setExpandedStep] = useState(null);

  if (!steps || steps.length === 0) return null;

  return (
    <div style={{
      background: 'var(--bg3)',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      overflow: 'hidden',
      margin: '8px 0',
      animation: 'fadeInUp 0.3s ease'
    }}>
      {/* Summary header — click to expand/collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 14px',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-dim)',
          cursor: 'pointer',
          fontSize: '12px',
          fontFamily: 'var(--font-mono)',
          textAlign: 'left'
        }}
      >
        <span style={{ fontSize: '14px' }}>🤖</span>
        <span style={{ color: 'var(--accent)', fontWeight: 500 }}>
          Agent used {steps.length} tool{steps.length !== 1 ? 's' : ''}
        </span>
        <span style={{ color: 'var(--text-muted)' }}>
          {iterations} iteration{iterations !== 1 ? 's' : ''}
          {duration ? ` · ${(duration / 1000).toFixed(1)}s` : ''}
        </span>
        <span style={{
          marginLeft: 'auto',
          transform: expanded ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s'
        }}>▾</span>
      </button>

      {/* Expandable step list */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '8px' }}>
          {steps.map((step, i) => {
            const color = TOOL_COLORS[step.tool] || 'var(--text-dim)';
            const icon = TOOL_ICONS[step.tool] || '🔧';
            const isOpen = expandedStep === i;

            return (
              <div key={i} style={{ marginBottom: '4px' }}>
                <button
                  onClick={() => setExpandedStep(isOpen ? null : i)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 8px',
                    background: isOpen ? 'rgba(255,255,255,0.04)' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                    textAlign: 'left',
                    color: 'var(--text)'
                  }}
                >
                  <span style={{
                    width: '20px', height: '20px',
                    background: `rgba(124,106,245,0.15)`,
                    borderRadius: '4px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', flexShrink: 0
                  }}>
                    {icon}
                  </span>
                  <span style={{ color }}>{step.tool}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                    {step.result_summary}
                  </span>
                  <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>
                    {isOpen ? '▴' : '▾'}
                  </span>
                </button>

                {/* Expanded detail: input + result */}
                {isOpen && (
                  <div style={{
                    padding: '8px 36px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-dim)',
                    lineHeight: '1.5'
                  }}>
                    <div style={{ marginBottom: '4px', color: 'var(--text-muted)' }}>Input:</div>
                    <pre style={{
                      background: 'var(--bg)',
                      padding: '8px',
                      borderRadius: '4px',
                      overflow: 'auto',
                      maxHeight: '200px',
                      fontSize: '11px',
                      color: 'var(--text)'
                    }}>
                      {JSON.stringify(step.input, null, 2)}
                    </pre>

                    {step.result && (
                      <>
                        <div style={{ margin: '6px 0 4px', color: 'var(--text-muted)' }}>Result:</div>
                        <pre style={{
                          background: 'var(--bg)',
                          padding: '8px',
                          borderRadius: '4px',
                          overflow: 'auto',
                          maxHeight: '200px',
                          fontSize: '11px',
                          color: step.result.success === false ? 'var(--red)' : 'var(--text)'
                        }}>
                          {JSON.stringify(step.result, null, 2)}
                        </pre>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
