import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Lightbulb, Play, RotateCcw, Undo2, Volume2, VolumeX } from "lucide-react";
import * as audio from "@/lib/audio";
import { Board } from "@/components/game/Board";

import titleArt from "@/assets/title-screen.jpg";
import { Victory } from "@/components/game/Victory";
import {
  applyMove,
  freeRange,
  generateLevel,
  isSolved,
  solve,
  type Difficulty,
  type Vehicle,
} from "@/lib/puzzle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Traffic Escape" },
      {
        name: "description",
        content:
          "Slide the cars to clear a path and drive the red car out. Endless procedurally generated levels across Easy, Medium and Hard.",
      },
      { property: "og:title", content: "Escape — Unblock the Red Car Puzzle" },
      {
        property: "og:description",
        content:
          "Endless sliding car puzzles, freshly generated for every level. Play on phone, tablet or desktop.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EscapeGame,
});

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "extra", "ultra"];
const LABELS: Record<Difficulty, string> = { easy: "EASY", medium: "MEDIUM", hard: "HARD", extra: "EXTRA HARD", ultra: "ULTRA HARD" };
const TONE: Record<Difficulty, string> = {
  easy: "text-easy",
  medium: "text-medium",
  hard: "text-hard",
  extra: "text-orange-500",
  ultra: "text-purple-500",
};
const STORAGE_KEY = "escape:progress";
const HINTS_PER_LEVEL = 2;
const INFINITE_HINTS = false; // testing only: set false before release

function formatTime(total: number) {
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function EscapeGame() {
const [screen, setScreen] = useState<"menu" | "loading" | "game">("menu");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [progress, setProgress] = useState<Record<Difficulty, number>>({
    easy: 1,
    medium: 1,
    hard: 1,
    extra: 1,
    ultra: 1,
  });

  const [level, setLevel] = useState(1);
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [optimal, setOptimal] = useState(0);
  const [history, setHistory] = useState<Vehicle[][]>([]);
  const [moves, setMoves] = useState(0);
  const [hints, setHints] = useState(HINTS_PER_LEVEL);
  const [hintIndex, setHintIndex] = useState<number | null>(null);
  const [escaping, setEscaping] = useState(false);
  const [won, setWon] = useState(false);
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const timers = useRef<number[]>([]);
  const hintBusy = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setProgress({ easy: 1, medium: 1, hard: 1, extra: 1, ultra: 1, ...JSON.parse(raw) });
    } catch {
      /* ignore unreadable storage */
    }
  }, []);

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  useEffect(() => {
    if (screen !== "game" || won || !vehicles) return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [screen, won, vehicles]);
  useEffect(() => {
    const unlock = () => audio.unlockAudio();
    const evts = ["pointerdown", "pointerup", "keydown", "touchend", "click"] as const;
    evts.forEach((e) => window.addEventListener(e, unlock, true));
    return () => evts.forEach((e) => window.removeEventListener(e, unlock, true));
  }, []);

  useEffect(() => {
    if (escaping) audio.escape();
  }, [escaping]);

  useEffect(() => {
    if (won) audio.win();
  }, [won]);

  const prevMoves = useRef(0);
  useEffect(() => {
    if (moves > prevMoves.current) audio.move();
    prevMoves.current = moves;
  }, [moves]);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

const startLevel = useCallback((lvl: number, diff: Difficulty, splash = false) => {
  audio.start();
  setLoading(true);
  setVehicles(null);
  setHistory([]);
  setMoves(0);
  setSeconds(0);
  setHints(HINTS_PER_LEVEL);
  setHintIndex(null);
  setEscaping(false);
  setWon(false);
  setLevel(lvl);
  setDifficulty(diff);
  setScreen(splash ? "loading" : "game");
  const startedAt = performance.now();
  window.setTimeout(() => {
    const built = generateLevel(lvl, diff);
    setVehicles(built.vehicles);
    setOptimal(built.optimalMoves);
    setLoading(false);
    if (splash) {
      // keep the loading screen up for at least 1.2s so it never just flashes
      const wait = Math.max(0, 1200 - (performance.now() - startedAt));
      window.setTimeout(() => setScreen("game"), wait);
    }
  }, 150);
}, []);

  const finish = useCallback(
       (diff: Difficulty, lvl: number, wait = 0) => {
      later(() => setEscaping(true), wait);
      later(() => setWon(true), wait + 620);
      setProgress((prev) => {
        const next = { ...prev, [diff]: Math.max(prev[diff], lvl + 1) };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* ignore unwritable storage */
        }
        return next;
      });
    },
    [],
  );

  const handleMove = useCallback(
    (index: number, delta: number, viaHint = false) => {
      setHintIndex(null);
      setVehicles((prev) => {
        if (!prev) return prev;
        const { min, max } = freeRange(prev, index);
        if (delta === 0 || delta < min || delta > max) return prev;
        const next = applyMove(prev, index, delta);
        setHistory((h) => [...h, prev]);
        setMoves((m) => m + 1);
       if (isSolved(next)) finish(difficulty, level, viaHint ? 350 : 0);
        return next;
      });
    },
    [difficulty, level, finish],
  );

  const undo = () => {
    if (!history.length || escaping) return;
    audio.undo()
    setVehicles(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
    setMoves((m) => Math.max(0, m - 1));
    setHintIndex(null);
  };

const useHint = () => {
  if (!vehicles || (!INFINITE_HINTS && hints <= 0) || escaping || hintBusy.current) return;
  audio.hint();
  const { first } = solve(vehicles);
  if (!first) return;
  hintBusy.current = true;
  if (!INFINITE_HINTS) setHints((h) => h - 1);
  setHintIndex(first.index);
  later(() => {
    hintBusy.current = false;
    handleMove(first.index, first.delta, true);
  }, 700);
};

  if (screen === "menu") {
    return (
      <Menu
        difficulty={difficulty}
        setDifficulty={setDifficulty}
        progress={progress}
        onPlay={() => startLevel(progress[difficulty], difficulty, true)}
      />
    );
  }
  if (screen === "loading") {
  return <LoadingScreen difficulty={difficulty} level={level} />;
}

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col px-4 pb-8 pt-5 sm:max-w-[700px]">
      <header className="flex items-center justify-between">
        <button
         onClick={() => { audio.click(); setScreen("menu"); }}
          aria-label="Back to menu"
          className="pill-btn size-12 bg-card text-foreground shadow-lg"
        >
          <ArrowLeft className="size-6" />
        </button>

        <div className="text-center">
          <p className={`text-xs font-bold tracking-[0.25em] ${TONE[difficulty]}`}>
            {LABELS[difficulty]}
          </p>
          <h1 className="text-2xl font-extrabold tracking-wide">Level {level}</h1>
        </div>

        <button
          onClick={() => startLevel(level, difficulty, true)}
          aria-label="Restart level"
          className="pill-btn size-12 bg-card text-foreground shadow-lg"
        >
          <RotateCcw className="size-6" />
        </button>
      </header>

      <div className="mt-4 flex items-center justify-center gap-6 text-sm font-semibold text-muted-foreground">
        <span>Moves {moves}</span>
        <span>{formatTime(seconds)}</span>
                <span>Best {optimal > 0 ? optimal : "—"}</span>
        <SoundToggle className="size-8 text-muted-foreground" />
      </div>

      <div className="relative mt-5 flex flex-1 items-center justify-center">
       <div
    className="relative w-full"
    style={{ maxWidth: "min(100%, max(280px, calc(100dvh - 200px)))" }}
  >
          {vehicles ? (
            <Board
              vehicles={vehicles}
              onMove={handleMove}
              locked={escaping || won}
              hintIndex={hintIndex}
              escaping={escaping}
            />
          ) : null}

          {won && (
            <Victory
              level={level}
              moves={moves}
              optimal={optimal}
              time={formatTime(seconds)}
              onNext={() => startLevel(level + 1, difficulty, true)}
            />
          )}
        </div>
      </div>

      <footer className="mt-6 flex items-center justify-between">
        <button
          onClick={undo}
          disabled={!history.length || escaping || won}
          aria-label="Undo last move"
          className="pill-btn size-14 bg-primary text-primary-foreground shadow-xl"
        >
          <Undo2 className="size-7" />
        </button>

        <p className="max-w-[55%] text-center text-xs font-semibold text-muted-foreground">
          Drag cars along their lane. Clear the way and drive the red car out.
        </p>

        <button
          onClick={useHint}
          disabled={(!INFINITE_HINTS && hints <= 0) || escaping || won || !vehicles}
          aria-label="Use a hint"
          className="pill-btn relative size-14 bg-primary text-primary-foreground shadow-xl"
        >
          <Lightbulb className="size-7" />
          <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-card text-xs font-bold text-foreground">
            {INFINITE_HINTS ? "∞" : hints}
          </span>
        </button>
      </footer>
    </main>
  );
}

interface MenuProps {
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  progress: Record<Difficulty, number>;
  onPlay: () => void;
}

function Menu({ difficulty, setDifficulty, progress, onPlay }: MenuProps) {
  const index = DIFFICULTIES.indexOf(difficulty);
  const step = (dir: 1 | -1) => {
    audio.click();
    setDifficulty(DIFFICULTIES[(index + dir + DIFFICULTIES.length) % DIFFICULTIES.length]!);
  };
  const fade = "radial-gradient(ellipse 62% 55% at 50% 50%, #000 55%, transparent 100%)";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#161a24] text-white">
      <SoundToggle className="absolute right-4 top-4 z-20 size-10 text-white/70 hover:text-white" />
      <img
        src={titleArt}
        alt=""
        aria-hidden
        draggable={false}
        className="pointer-events-none absolute left-1/2 top-1/2 w-[130%] max-w-[900px] -translate-x-1/2 -translate-y-1/2 select-none opacity-40"
        style={{ maskImage: fade, WebkitMaskImage: fade }}
      />
      <main className="animate-screen-in relative z-10 mx-auto flex min-h-screen w-full max-w-[420px] flex-col items-center justify-between px-6 pb-8 pt-12 text-center">
        <div className="flex flex-col items-center">
          <div className="mb-4 h-1.5 w-10 rounded-full bg-[var(--car-red)]" />
          <h1 className="pl-[0.3em] text-5xl font-extrabold tracking-[0.3em] drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)] sm:text-6xl">
            ESCAPE
          </h1>
          <p className="mt-3 text-sm font-semibold text-white/70">Slide the cars. Free the red one.</p>
        </div>

        <div className="flex w-full flex-col items-center">
          <div className="flex w-full items-center justify-between">
            <button
              onClick={() => step(-1)}
              aria-label="Previous difficulty"
              className="pill-btn size-12 text-white/60 transition-colors hover:text-white"
            >
              <ChevronLeft className="size-7" />
            </button>
            <div key={difficulty} className="animate-rise">
              <p className={`text-3xl font-extrabold tracking-[0.12em] ${TONE[difficulty]}`}>
                {LABELS[difficulty]}
              </p>
              <p className="mt-1 text-sm font-semibold text-white/70">Level {progress[difficulty]}</p>
            </div>
            <button
              onClick={() => step(1)}
              aria-label="Next difficulty"
              className="pill-btn size-12 text-white/60 transition-colors hover:text-white"
            >
              <ChevronRight className="size-7" />
            </button>
          </div>

          <div className="mt-6 flex items-center gap-2">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
               onClick={() => { audio.click(); setDifficulty(d); }}
                aria-label={LABELS[d]}
                aria-pressed={d === difficulty}
                className={[
                  "h-1.5 rounded-full transition-all duration-300",
                  d === difficulty ? `w-6 bg-current ${TONE[d]}` : "w-1.5 bg-white/30",
                ].join(" ")}
              />
            ))}
          </div>

          <button
            onClick={onPlay}
            className="pill-btn mt-8 h-14 w-full max-w-[280px] gap-2 bg-primary text-lg font-extrabold tracking-[0.2em] text-primary-foreground shadow-xl hover:scale-[1.02]"
          >
            PLAY
          </button>
          <p className="mt-6 text-xs font-semibold text-white/40">Endless levels</p>
        </div>
      </main>
    </div>
  );
}

function LoadingScreen({ difficulty, level }: { difficulty: Difficulty; level: number }) {
  return (
    <main
      role="status"
      className="animate-screen-in mx-auto flex min-h-screen w-full flex-col items-center justify-center px-6 text-center"
    >
      <span className="sr-only">Loading level</span>

      <div className="relative h-2 w-40 overflow-hidden rounded-full bg-secondary">
        <div className="animate-slide-track absolute inset-y-0 left-0 w-1/3 rounded-full bg-[var(--car-red)]" />
      </div>

      <p className={`mt-8 text-xs font-bold tracking-[0.3em] ${TONE[difficulty]}`}>
        {LABELS[difficulty]}
      </p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-wide">Level {level}</h1>
    </main>
  );
}
function SoundToggle({ className = "" }: { className?: string }) {
  const [muted, setMutedState] = useState(false);
  useEffect(() => {
    setMutedState(audio.isMuted());
  }, []);
  return (
    <button
      onClick={() => {
        const m = !muted;
        audio.setMuted(m);
        setMutedState(m);
        audio.click();
      }}
      aria-label={muted ? "Unmute sound" : "Mute sound"}
      className={`pill-btn ${className}`}
    >
      {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
    </button>
  );
}
