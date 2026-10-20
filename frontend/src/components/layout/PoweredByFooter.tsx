import React from 'react';

/* ─── Main Component ──────────────────────────────────────────────────────── */
const PoweredByFooter: React.FC = () => {
  return (
    <>
      <style>{`
        @keyframes _sfmPbfShimmer {
          0%   { background-position: -300% center; }
          100% { background-position: 300% center; }
        }
        @keyframes _sfmPbfFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        #sfm-powered-by-footer {
          animation: _sfmPbfFadeIn 0.5s ease both;
        }
      `}</style>

      <div
        id="sfm-powered-by-footer"
        style={{
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
          background: '#ffffff',
          borderTop: '1px solid #e2e8f0',
        }}
      >
        {/* Shimmer highlight line at very top */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1.5,
          background:
            'linear-gradient(90deg, transparent 0%, rgba(0,104,122,0.4) 25%, rgba(76,141,255,0.35) 50%, rgba(0,104,122,0.4) 75%, transparent 100%)',
          backgroundSize: '300% 100%',
          animation: '_sfmPbfShimmer 6s linear infinite',
        }} />

        {/* Content row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: '8px 32px 10px',
          flexWrap: 'nowrap',
        }}>
          {/* Label */}
          <span style={{
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: '0.13em',
            textTransform: 'uppercase',
            color: '#75777d',
            whiteSpace: 'nowrap',
            fontFamily: 'Inter, sans-serif',
            flexShrink: 0,
          }}>
            Powered by
          </span>

          {/* Thin separator */}
          <div style={{ width: 1, height: 22, background: '#e2e8f0', flexShrink: 0 }} />

          {/* Real Banner.png with all partner logos */}
          <img
            src="/Banner.png"
            alt="Powered by: UPI, DIHSTP, Dtech Edge Innovation, Pertamina EP, Smart Flow Meter"
            style={{
              height: 34,
              width: 'auto',
              objectFit: 'contain',
              display: 'block',
              userSelect: 'none',
              flexShrink: 1,
              minWidth: 0,
              maxWidth: '100%',
            }}
            draggable={false}
          />
        </div>
      </div>
    </>
  );
};

export default PoweredByFooter;
