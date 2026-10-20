import { useEffect, useRef } from 'react';

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  base: number;
  phase: number;
  speed: number;
};

function spawn(width: number, height: number, flow: boolean): Particle {
  if (flow) {
    return {
      x: width * (0.04 + Math.random() * 0.28),
      y: height * (0.55 + Math.random() * 0.38),
      vx: 0.25 + Math.random() * 0.55,
      vy: -0.12 - Math.random() * 0.28,
      r: 0.8 + Math.random() * 2.2,
      base: 0.25 + Math.random() * 0.55,
      phase: Math.random() * Math.PI * 2,
      speed: 0.015 + Math.random() * 0.03,
    };
  }
  return {
    x: Math.random() * width * 0.72,
    y: Math.random() * height,
    vx: (Math.random() - 0.4) * 0.18,
    vy: -0.05 - Math.random() * 0.12,
    r: 0.5 + Math.random() * 1.6,
    base: 0.12 + Math.random() * 0.35,
    phase: Math.random() * Math.PI * 2,
    speed: 0.01 + Math.random() * 0.025,
  };
}

export default function LoginParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let particles: Particle[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = reduceMotion ? 28 : Math.min(110, Math.floor((window.innerWidth * window.innerHeight) / 14000));
      particles = Array.from({ length: count }, (_, i) => spawn(window.innerWidth, window.innerHeight, i % 3 !== 0));
    };

    const tick = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.phase += p.speed;

        if (p.x > w * 0.78 || p.y < -8 || p.x < -8 || p.y > h + 8) {
          Object.assign(p, spawn(w, h, Math.random() > 0.35));
          if (p.vx > 0) {
            p.x = w * (0.02 + Math.random() * 0.2);
            p.y = h * (0.62 + Math.random() * 0.32);
          }
        }

        const alpha = p.base * (0.55 + 0.45 * Math.sin(p.phase));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(87, 223, 254, ${alpha})`;
        ctx.shadowColor = 'rgba(87, 223, 254, 0.9)';
        ctx.shadowBlur = 10 + p.r * 4;
        ctx.fill();
      }

        ctx.shadowBlur = 0;
      if (!reduceMotion) raf = requestAnimationFrame(tick);
    };

    resize();
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-0"
      aria-hidden
    />
  );
}
