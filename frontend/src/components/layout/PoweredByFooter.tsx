import React from 'react';

/* ─── Inline SVG logos ────────────────────────────────────────────────────── */

const LogoUPI = () => (
  <svg viewBox="0 0 120 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ height: '30px', width: 'auto' }}>
    <path d="M18 10 L29 16 L29 26 Q29 34 18 38 Q7 34 7 26 L7 16 Z" fill="#c0392b"/>
    <path d="M18 14 L26 19 L26 27 Q26 33 18 36 Q10 33 10 27 L10 19 Z" fill="#ffffff" opacity="0.9"/>
    <path d="M15 22 Q15 28 18 30 Q21 28 21 22 L21 19 L15 19 Z" fill="#c0392b"/>
    <text x="36" y="21" fontFamily="Inter, sans-serif" fontSize="14" fontWeight="800" fill="#ef4444">UPI</text>
    <text x="36" y="30" fontFamily="Inter, sans-serif" fontSize="6" fontWeight="400" fill="rgba(255,255,255,0.6)">The Education</text>
    <text x="36" y="39" fontFamily="Inter, sans-serif" fontSize="6" fontWeight="400" fill="rgba(255,255,255,0.6)">University</text>
  </svg>
);

const LogoDIHSTP = () => (
  <svg viewBox="0 0 148 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ height: '30px', width: 'auto' }}>
    <path d="M10 10 L18 6 L26 10 L26 22 Q26 30 18 34 Q10 30 10 22 Z" fill="#1a3a6b"/>
    <path d="M13 13 L18 10 L23 13 L23 22 Q23 28 18 31 Q13 28 13 22 Z" fill="white" opacity="0.85"/>
    <circle cx="18" cy="20" r="3.5" fill="#c0392b"/>
    <text x="32" y="23" fontFamily="Inter, sans-serif" fontSize="14" fontWeight="900" fill="#ef4444">DIH</text>
    <text x="68" y="23" fontFamily="Inter, sans-serif" fontSize="14" fontWeight="900" fill="#60a5fa">STP</text>
    <text x="32" y="32" fontFamily="Inter, sans-serif" fontSize="5" fontWeight="400" fill="rgba(255,255,255,0.55)">DIREKTORAT INOVASI,</text>
    <text x="32" y="39" fontFamily="Inter, sans-serif" fontSize="5" fontWeight="400" fill="rgba(255,255,255,0.55)">HILIRISASI DAN SCIENCE TECHNO PARK</text>
  </svg>
);

const LogoDtech = () => (
  <svg viewBox="0 0 120 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ height: '28px', width: 'auto' }}>
    {[0,1,2].map(row => [0,1,2].map(col => (
      <circle key={`${row}-${col}`} cx={6 + col * 8} cy={13 + row * 8} r={2.5}
        fill={row === 1 && col === 1 ? '#22d3ee' : 'rgba(34,211,238,0.45)'} />
    )))}
    <text x="36" y="24" fontFamily="Inter, sans-serif" fontSize="14" fontWeight="900" fill="white">DTECH</text>
    <text x="36" y="36" fontFamily="Inter, sans-serif" fontSize="6.5" fontWeight="600" fill="rgba(34,211,238,0.8)">EDGE INNOVATION</text>
  </svg>
);

const LogoPertamina = () => (
  <svg viewBox="0 0 130 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ height: '26px', width: 'auto' }}>
    <path d="M4 24 L16 13 L16 35 Z" fill="#ef4444"/>
    <path d="M13 24 L24 14.5 L24 33.5 Z" fill="#dc2626" opacity="0.75"/>
    <text x="30" y="24" fontFamily="Inter, sans-serif" fontSize="11" fontWeight="800" fill="white">PERTAMINA</text>
    <text x="30" y="37" fontFamily="Inter, sans-serif" fontSize="10" fontWeight="700" fill="rgba(255,255,255,0.7)">EP</text>
  </svg>
);

const LogoSFM = () => (
  <svg viewBox="0 0 110 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ height: '32px', width: 'auto' }}>
    <path d="M0 34 Q14 27 28 34 Q42 41 56 34" stroke="#22d3ee" strokeWidth="1.5" fill="none" opacity="0.4"/>
    <path d="M0 40 Q14 33 28 40 Q42 47 56 40" stroke="#22d3ee" strokeWidth="1" fill="none" opacity="0.25"/>
    <text x="0" y="30" fontFamily="Inter, sans-serif" fontSize="24" fontWeight="900"
      fill="url(#sfm-grad)">SFM</text>
    <text x="1" y="44" fontFamily="Inter, sans-serif" fontSize="6" fontWeight="600" fill="rgba(34,211,238,0.85)">SMART FLOW METER</text>
    <defs>
      <linearGradient id="sfm-grad" x1="0" y1="0" x2="70" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ffffff"/>
        <stop offset="100%" stopColor="#22d3ee"/>
      </linearGradient>
    </defs>
  </svg>
);

/* ─── Divider ─────────────────────────────────────────────────────────────── */
const Divider = () => (
  <div style={{ width: 1, height: 30, background: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />
);

/* ─── Main Component ──────────────────────────────────────────────────────── */
const PoweredByFooter: React.FC = () => {
  return (
    <>
      <style>{`
        @keyframes _sfmFooterShimmer {
          0%   { background-position: -300% center; }
          100% { background-position: 300% center; }
        }
        @keyframes _sfmFooterPulse {
          0%, 100% { opacity: 0.3; transform: scale(1);   }
          50%       { opacity: 0.9; transform: scale(1.5); }
        }
        @keyframes _sfmFooterGlow {
          0%, 100% { box-shadow: 0 -4px 24px rgba(34,211,238,0.10); }
          50%       { box-shadow: 0 -4px 36px rgba(34,211,238,0.22); }
        }
        .sfm-pbf-logo {
          display: flex;
          align-items: center;
          transition: filter 0.25s ease, transform 0.25s ease;
          filter: brightness(0.8) saturate(0.7);
        }
        .sfm-pbf-logo:hover {
          filter: brightness(1.2) saturate(1.3);
          transform: translateY(-2px);
        }
      `}</style>

      {/* ── Fixed overlay ── */}
      <div
        id="sfm-powered-by-footer"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          pointerEvents: 'none',
          /* layered background: two radial glows + linear dark gradient */
          background: `
            radial-gradient(ellipse 55% 100% at 10% 130%, rgba(0,104,122,0.40) 0%, transparent 65%),
            radial-gradient(ellipse 45% 90%  at 90% 130%, rgba(76,141,255,0.28) 0%, transparent 65%),
            linear-gradient(
              to bottom,
              transparent                  0%,
              rgba(9,20,38,0.50)          25%,
              rgba(9,20,38,0.86)          55%,
              rgba(9,20,38,0.97)         100%
            )
          `,
          animation: '_sfmFooterGlow 5s ease-in-out infinite',
        }}
      >
        {/* Shimmer top line */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1.5,
          background:
            'linear-gradient(90deg, transparent 0%, rgba(34,211,238,0.7) 30%, rgba(96,165,250,0.6) 50%, rgba(34,211,238,0.7) 70%, transparent 100%)',
          backgroundSize: '300% 100%',
          animation: '_sfmFooterShimmer 5s linear infinite',
        }} />

        {/* Ambient background dots */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          {[
            { l: '5%',  t: '40%', d: '0s',    s: 3 },
            { l: '18%', t: '65%', d: '1.1s',  s: 2 },
            { l: '33%', t: '30%', d: '2.2s',  s: 2.5 },
            { l: '50%', t: '60%', d: '0.5s',  s: 2 },
            { l: '66%', t: '35%', d: '1.7s',  s: 3 },
            { l: '80%', t: '55%', d: '0.9s',  s: 2.5 },
            { l: '94%', t: '45%', d: '2.8s',  s: 2 },
          ].map((dot, i) => (
            <div key={i} style={{
              position: 'absolute',
              left: dot.l,
              top: dot.t,
              width: dot.s,
              height: dot.s,
              borderRadius: '50%',
              background: 'rgba(34,211,238,0.65)',
              animation: `_sfmFooterPulse 3.5s ease-in-out ${dot.d} infinite`,
            }} />
          ))}
        </div>

        {/* Content */}
        <div style={{
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0,
          padding: '8px 24px 11px',
          flexWrap: 'nowrap',
        }}>
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.45)',
            whiteSpace: 'nowrap',
            marginRight: 18,
            fontFamily: 'Inter, sans-serif',
          }}>
            Powered by
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'nowrap' }}>
            <div className="sfm-pbf-logo"><LogoUPI /></div>
            <Divider />
            <div className="sfm-pbf-logo"><LogoDIHSTP /></div>
            <Divider />
            <div className="sfm-pbf-logo"><LogoDtech /></div>
            <Divider />
            <div className="sfm-pbf-logo"><LogoPertamina /></div>
            <Divider />
            <div className="sfm-pbf-logo"><LogoSFM /></div>
          </div>
        </div>
      </div>

      {/* Bottom padding so page content is not hidden behind footer */}
      <div style={{ height: 60, pointerEvents: 'none' }} />
    </>
  );
};

export default PoweredByFooter;
