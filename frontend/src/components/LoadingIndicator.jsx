export default function LoadingIndicator() {
  return (
    <div style={{
      display: 'flex',
      gap: '10px',
      marginBottom: '16px',
      animation: 'fadeInUp 0.2s ease'
    }}>
      {/* Pulsing avatar */}
      <div style={{
        width: '28px', height: '28px',
        background: 'var(--accent-glow)',
        border: '1px solid var(--accent)',
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '14px', flexShrink: 0,
        animation: 'pulse 1.5s ease-in-out infinite'
      }}>
        🤖
      </div>

      <div style={{ paddingTop: '4px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: 'var(--text-dim)',
          fontSize: '13px',
          fontFamily: 'var(--font-mono)',
          marginBottom: '6px'
        }}>
          <span>thinking</span>
          <span style={{ animation: 'blink 1s infinite' }}>▌</span>
        </div>

        {/* Animated bouncing dots */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: '6px', height: '6px',
              background: 'var(--accent)',
              borderRadius: '50%',
              animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}
