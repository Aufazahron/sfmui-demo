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
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        #sfm-powered-by-footer {
          animation: _sfmPbfFadeIn 0.6s ease both;
        }
      `}</style>

      {/*
       * ── Sticky footer: sits at the bottom of the scrollable main area.
       *    Uses `sticky` + `bottom: 0` so it stays in-flow (not over sidebar).
       *    A top-gradient fades page content into the white banner.
       */}
      <div
        id="sfm-powered-by-footer"
        style={{
          position: 'sticky',
          bottom: 0,
          /* pull it outside the 24 px padding of <main> so it bleeds edge-to-edge */
          marginLeft: '-24px',
          marginRight: '-24px',
          marginBottom: '-24px',
          zIndex: 10,
          overflow: 'hidden',
        }}
      >
        {/* Soft fade from page background into banner */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 28,
          background: 'linear-gradient(to bottom, rgba(248,249,255,0) 0%, rgba(248,249,255,0.95) 100%)',
          pointerEvents: 'none',
          zIndex: 1,
        }} />

        {/* Shimmer highlight line at top of banner */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1.5,
          background:
            'linear-gradient(90deg, transparent 0%, rgba(0,104,122,0.35) 25%, rgba(76,141,255,0.3) 50%, rgba(0,104,122,0.35) 75%, transparent 100%)',
          backgroundSize: '300% 100%',
          animation: '_sfmPbfShimmer 6s linear infinite',
          zIndex: 2,
        }} />

        {/* ── The banner itself: white/light background + Banner.png image ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: '10px 32px 12px',
          background: '#ffffff',
          borderTop: '1px solid rgba(0,104,122,0.12)',

          flexWrap: 'nowrap',
          position: 'relative',
          zIndex: 0,
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

          {/* Thin vertical separator before logo strip */}
          <div style={{ width: 1, height: 24, background: '#e2e8f0', flexShrink: 0 }} />

          {/* Banner image — contains all logos, displayed at a compact height */}
          <img
            src="/Banner.png"
            alt="Powered by: UPI · DIHSTP · Dtech Edge Innovation · Pertamina EP · Smart Flow Meter"
            style={{
              height: 36,
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

