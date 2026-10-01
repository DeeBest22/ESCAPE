import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import confetti from "canvas-confetti";

interface VictoryProps {
  level: number;
  moves: number;
  optimal: number;
  time: string;
  onNext: () => void;
}

const GREEN = "#34d399";
const GOLD = "#fbbf24";
const COLORS = [GREEN, GOLD, "#ffffff", "#60a5fa", "#f472b6", "#f87171"];
const EASE_OUT = "cubic-bezier(0.2, 0.8, 0.2, 1)";
const SPRING = "cubic-bezier(0.3, 1.6, 0.5, 1)";

const STAR_START = 0.8; // seconds
const STAR_STEP = 0.16;

const anim = (name: string, dur: number, delay: number, ease = EASE_OUT): CSSProperties => ({
  animation: `${name} ${dur}s ${ease} ${delay}s both`,
});

const CSS = `
@keyframes vc-fade{from{opacity:0}to{opacity:1}}
@keyframes vc-card{from{opacity:0;transform:translateY(24px) scale(.92)}to{opacity:1;transform:none}}
@keyframes vc-pop{from{opacity:0;transform:scale(.3) rotate(-18deg)}to{opacity:1;transform:none}}
@keyframes vc-rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes vc-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
.vc-next{transition:transform .15s ease, box-shadow .15s ease}
.vc-next:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(52,211,153,.4)}
.vc-next:active{transform:translateY(1px) scale(.98)}
.vc-next:focus-visible{outline:3px solid #fff;outline-offset:3px}
@media (prefers-reduced-motion:reduce){.vc-canvas{display:none}}
`;

/** Counts from 0 to `target` after `delayMs`. Jumps straight to target for reduced motion. */
function useCountUp(target: number, delayMs: number, durationMs = 800) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let raf = 0;
    const timer = window.setTimeout(() => {
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / durationMs);
        setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delayMs);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [target, delayMs, durationMs]);

  return value;
}

export function Victory({ level, moves, optimal, time, onNext }: VictoryProps) {
  const stars = optimal > 0 ? (moves <= optimal ? 3 : moves <= Math.ceil(optimal * 1.5) ? 2 : 1) : 3;
  const word = ["", "AWESOME!", "CONGRATULATIONS!", "PERFECT!"][stars];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starRefs = useRef<(SVGSVGElement | null)[]>([]);

  const movesShown = useCountUp(moves, 1100);
  const bestShown = useCountUp(optimal, 1200);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const fire = confetti.create(canvas, {
      resize: true,
      useWorker: true,
      disableForReducedMotion: true,
    });

    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    const k = 0.55 + stars * 0.15; // more stars, more confetti
    const n = (x: number) => Math.round(x * k);
    const base = { colors: COLORS, ticks: 260, gravity: 0.95, scalar: 1.15, zIndex: 1 };

    // 1. Big burst from the middle of the screen
    at(350, () =>
      fire({ ...base, particleCount: n(140), spread: 110, startVelocity: 52, origin: { x: 0.5, y: 0.45 } })
    );
    // 2. Cannons from the bottom corners of the whole page
    at(650, () => {
      fire({ ...base, particleCount: n(80), angle: 62, spread: 60, startVelocity: 75, origin: { x: 0, y: 1 } });
      fire({ ...base, particleCount: n(80), angle: 118, spread: 60, startVelocity: 75, origin: { x: 1, y: 1 } });
    });
    // 3. Streams from the left and right edges
    at(1000, () => {
      fire({ ...base, particleCount: n(50), angle: 25, spread: 50, startVelocity: 55, origin: { x: 0, y: 0.55 } });
      fire({ ...base, particleCount: n(50), angle: 155, spread: 50, startVelocity: 55, origin: { x: 1, y: 0.55 } });
    });

    // 4. A small gold pop on each earned star as it lands
    for (let i = 0; i < stars; i++) {
      const el = starRefs.current[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const origin = {
        x: (r.left + r.width / 2) / window.innerWidth,
        y: (r.top + r.height / 2) / window.innerHeight,
      };
      at((STAR_START + i * STAR_STEP + 0.25) * 1000, () =>
        fire({
          shapes: ["star"],
          colors: [GOLD, "#fde68a", "#ffffff"],
          particleCount: 16,
          spread: 360,
          startVelocity: 18,
          gravity: 0.7,
          ticks: 70,
          scalar: 0.85,
          origin,
          zIndex: 1,
        })
      );
    }

    // 5. Perfect score: golden shower across the full width
    if (stars === 3) {
      at(1500, () => {
        const end = Date.now() + 1400;
        const rain = () => {
          fire({
            colors: [GOLD, "#fde68a", "#ffffff"],
            shapes: ["star", "circle"],
            particleCount: 4,
            angle: 90,
            spread: 120,
            startVelocity: 16,
            gravity: 0.6,
            ticks: 320,
            scalar: 1,
            origin: { x: Math.random(), y: -0.05 },
            zIndex: 1,
          });
          if (Date.now() < end) timers.push(window.setTimeout(rain, 55));
        };
        rain();
      });
    }

    return () => {
      timers.forEach(clearTimeout);
      fire.reset();
    };
  }, [stars]);

  if (typeof document === "undefined") return null;

  // Rendered into <body> so it covers the whole page instead of the game board.
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        overflow: "hidden",
        color: "#fff",
        fontFamily: "inherit",
        background: "radial-gradient(circle at 50% 45%, rgba(16,185,129,0.14), rgba(6,8,14,0.84) 70%)",
        backdropFilter: "blur(5px)",
        WebkitBackdropFilter: "blur(5px)",
        ...anim("vc-fade", 0.5, 0),
      }}
    >
      <style>{CSS}</style>

      <canvas
        ref={canvasRef}
        className="vc-canvas"
        aria-hidden
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 1 }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 2,
          width: "min(100%, 320px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <svg
          viewBox="0 0 64 64"
          width="52"
          height="52"
          aria-hidden
          style={anim("vc-pop", 0.6, 0.15, "cubic-bezier(0.2, 1.4, 0.4, 1)")}
          fill="none"
          stroke={GREEN}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="32" cy="32" r="28" pathLength={1} strokeDasharray={1} style={anim("vc-draw", 0.7, 0.25)} />
          <path d="M20 33l8 8 16-17" stroke="#fff" pathLength={1} strokeDasharray={1} style={anim("vc-draw", 0.4, 0.65)} />
        </svg>

        <p style={{ margin: "22px 0 0", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.55)", ...anim("vc-rise", 0.6, 0.5) }}>
          Level {level} complete
        </p>

        <h2
          style={{
            margin: "2px 0 0",
            fontSize: 64,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.01em",
            ...anim("vc-rise", 0.6, 0.6),
          }}
        >
          {word}
        </h2>

        <div style={{ display: "flex", gap: 8, marginTop: 14 }} aria-label={`${stars} out of 3 stars`}>
          {[0, 1, 2].map((i) => {
            const earned = i < stars;
            return (
              <svg
                key={i}
                ref={(el) => {
                  starRefs.current[i] = el;
                }}
                viewBox="0 0 24 24"
                width={34}
                height={34}
                aria-hidden
                style={{
                  color: earned ? GOLD : "rgba(255,255,255,0.14)",
                  filter: earned ? "drop-shadow(0 0 8px rgba(251,191,36,0.5))" : undefined,
                  ...anim("vc-pop", 0.5, STAR_START + i * STAR_STEP, SPRING),
                }}
              >
                <path fill="currentColor" d="M12 1.6l2.9 6.1 6.7.9-4.9 4.6 1.2 6.6L12 16.7 6.1 19.8l1.2-6.6L2.4 8.6l6.7-.9z" />
              </svg>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 36, marginTop: 30, ...anim("vc-rise", 0.6, 1.05) }}>
          {[
            { label: "Moves", value: String(movesShown) },
            { label: "Time", value: time },
            { label: "Best", value: String(bestShown) },
          ].map((s) => (
            <div key={s.label}>
              <div style={{ fontSize: 21, fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>
                {s.value}
              </div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onNext}
          className="pill-btn vc-next"
          style={{
            marginTop: 34,
            minWidth: 200,
            padding: "14px 40px",
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: "0.02em",
            cursor: "pointer",
            border: "none",
            background: GREEN,
            color: "#052e22",
            boxShadow: "0 6px 22px rgba(52,211,153,0.28)",
            ...anim("vc-rise", 0.6, 1.25),
          }}
        >
          Next level
        </button>
      </div>
    </div>,
    document.body
  );
}