import { useCallback, useEffect, useRef, useState } from "react";
import { CarSprite } from "./CarSprite";
import { EXIT_ROW, SIZE, freeRange, type Vehicle } from "@/lib/puzzle";

interface BoardProps {
  vehicles: Vehicle[];
  onMove: (index: number, delta: number) => void;
  locked: boolean;
  hintIndex: number | null;
  escaping: boolean;
}

interface DragState {
  index: number;
  startX: number;
  startY: number;
  offset: number;
  minPx: number;
  maxPx: number;
}

export function Board({ vehicles, onMove, locked, hintIndex, escaping }: BoardProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(0);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize(el.clientWidth));
    ro.observe(el);
    setSize(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const cell = size / SIZE;

  const endDrag = useCallback(() => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d || cell <= 0) return;
    const steps = Math.round(d.offset / cell);
    if (steps !== 0) onMove(d.index, steps);
  }, [cell, onMove]);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const v = vehicles[d.index];
      const raw = v.orient === "h" ? e.clientX - d.startX : e.clientY - d.startY;
      const offset = Math.max(d.minPx, Math.min(d.maxPx, raw));
      const next = { ...d, offset };
      dragRef.current = next;
      setDrag(next);
    };
    const up = () => endDrag();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [endDrag, vehicles]);

  const startDrag = (index: number, e: React.PointerEvent) => {
    if (locked || cell <= 0) return;
    e.preventDefault();
    const { min, max } = freeRange(vehicles, index);
    const state: DragState = {
      index,
      startX: e.clientX,
      startY: e.clientY,
      offset: 0,
      minPx: min * cell,
      maxPx: max * cell,
    };
    dragRef.current = state;
    setDrag(state);
  };

  return (
    <div
      className="relative mx-auto w-full"
      style={{
        // Never let the square board be taller than the space available on screen.
        maxWidth: "min(100%, max(280px, calc(100dvh - 320px)))",
      }}
    >
      {/* exit marker */}
    {/* exit marker */}
<div
  className="pointer-events-none absolute z-20 flex items-center justify-center"
  style={{
    right: -18,
    top: `${EXIT_ROW * (100 / SIZE)}%`,
    height: `${100 / SIZE}%`,
    width: 22,
  }}
>
  <ExitChevrons />
</div>

      <div className="board-frame">
        <div ref={wrapRef} className="board-surface">
          {Array.from({ length: SIZE * SIZE }).map((_, i) => (
            <div key={i} className="board-cell" />
          ))}

          {/* exit gap in the wall */}
          <div
            className="board-exit"
            style={{ top: `${EXIT_ROW * (100 / SIZE)}%`, height: `${100 / SIZE}%` }}
          />

          {size > 0 &&
            vehicles.map((v, index) => {
              const w = (v.orient === "h" ? v.len : 1) * cell;
              const h = (v.orient === "v" ? v.len : 1) * cell;
              const dragging = drag?.index === index;
              const off = dragging ? drag.offset : 0;
              const x = v.col * cell + (v.orient === "h" ? off : 0);
              const y = v.row * cell + (v.orient === "v" ? off : 0);
              const escapeShift = v.target && escaping ? cell * 3.2 : 0;

              return (
                <div
                  key={v.id}
                  role="button"
                  tabIndex={0}
                  aria-label={v.target ? "Red car" : `Vehicle ${v.id}`}
                  onPointerDown={(e) => startDrag(index, e)}
                  className={[
                    "vehicle",
                    dragging ? "vehicle-dragging" : "vehicle-settling",
                    hintIndex === index ? "vehicle-hint" : "",
                    v.orient === "h" ? "cursor-ew-resize" : "cursor-ns-resize",
                  ].join(" ")}
                  style={{
                    width: w,
                    height: h,
                    transform: `translate3d(${x + escapeShift}px, ${y}px, 0)`,
                    opacity: escaping && v.target ? 0 : 1,
                    zIndex: dragging ? 15 : v.target ? 12 : 10,
                  }}
                >
                  <div
                    className="absolute left-1/2 top-1/2"
                    style={{
                      width: v.len * cell,
                      height: cell,
                      transform: `translate(-50%, -50%) rotate(${v.orient === "v" ? 90 : 0}deg)`,
                    }}
                  >
                    <div className="absolute inset-x-[2%] inset-y-[4%]">
                      <CarSprite sprite={v.sprite} target={v.target} />
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

function ExitChevrons() {
  return (
    <div
      className="flex h-full flex-col items-center justify-center text-[var(--exit-arrow,#ffffff)]"
      aria-hidden
    >
      {[0, 1, 2].map((i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          className="h-[26%] w-4"
          style={{ filter: "drop-shadow(0 1px 1px rgba(0, 0, 0, 0.35))" }}
          fill="none"
          stroke="currentColor"
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 5l7 7-7 7" />
        </svg>
      ))}
    </div>
  );
}