import { TARGET_SPRITE, pickSprite } from "./vehicles";

export const SIZE = 6;
export const EXIT_ROW = 2;

export type Orient = "h" | "v";
export type Difficulty = "easy" | "medium" | "hard" | "extra" | "ultra";

export interface Vehicle {
  id: number;
  row: number;
  col: number;
  len: number;
  orient: Orient;
  sprite: string;
  target: boolean;
}

export interface Move {
  index: number;
  delta: number;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function posOf(v: Vehicle) {
  return v.orient === "h" ? v.col : v.row;
}

function positions(vs: Vehicle[]) {
  return vs.map(posOf);
}

function gridOf(vs: Vehicle[], pos: number[]) {
  const g = new Int8Array(SIZE * SIZE).fill(-1);
  for (let i = 0; i < vs.length; i++) {
    const v = vs[i]!;
    for (let k = 0; k < v.len; k++) {
      const r = v.orient === "h" ? v.row : pos[i]! + k;
      const c = v.orient === "h" ? pos[i]! + k : v.col;
      g[r * SIZE + c] = i;
    }
  }
  return g;
}

/** How far (in cells) vehicle `index` can slide backwards (min, <=0) and forwards (max, >=0). */
export function freeRange(vs: Vehicle[], index: number) {
  const pos = positions(vs);
  const g = gridOf(vs, pos);
  const v = vs[index]!;
  let min = 0;
  let max = 0;
  for (let step = 1; step < SIZE; step++) {
    const head = pos[index]! - step;
    if (head < 0) break;
    const r = v.orient === "h" ? v.row : head;
    const c = v.orient === "h" ? head : v.col;
    if (g[r * SIZE + c] !== -1) break;
    min = -step;
  }
  for (let step = 1; step < SIZE; step++) {
    const head = pos[index]! + v.len - 1 + step;
    if (head >= SIZE) break;
    const r = v.orient === "h" ? v.row : head;
    const c = v.orient === "h" ? head : v.col;
    if (g[r * SIZE + c] !== -1) break;
    max = step;
  }
  return { min, max };
}

export function applyMove(vs: Vehicle[], index: number, delta: number): Vehicle[] {
  return vs.map((v, i) => {
    if (i !== index || delta === 0) return v;
    return v.orient === "h" ? { ...v, col: v.col + delta } : { ...v, row: v.row + delta };
  });
}

export function isSolved(vs: Vehicle[]) {
  const t = vs[0]!;
  return t.col + t.len === SIZE;
}

function neighbors(vs: Vehicle[], pos: number[]) {
  const g = gridOf(vs, pos);
  const out: { pos: number[]; move: Move }[] = [];
  for (let i = 0; i < vs.length; i++) {
    const v = vs[i]!;
    for (const dir of [-1, 1] as const) {
      for (let step = 1; step < SIZE; step++) {
        const np = pos[i]! + dir * step;
        const head = dir < 0 ? np : np + v.len - 1;
        if (head < 0 || head >= SIZE) break;
        const r = v.orient === "h" ? v.row : head;
        const c = v.orient === "h" ? head : v.col;
        if (g[r * SIZE + c] !== -1) break;
        const copy = pos.slice();
        copy[i] = np;
        out.push({ pos: copy, move: { index: i, delta: dir * step } });
      }
    }
  }
  return out;
}

export interface SolveResult {
  moves: number;
  first: Move | null;
}

/** Breadth-first search for the shortest solution. Returns moves = -1 when unsolvable. */
export function solve(vs: Vehicle[], limit = 200000): SolveResult {
  const start = positions(vs);
  const goal = SIZE - vs[0]!.len;
  if (start[0] === goal) return { moves: 0, first: null };

  const startKey = start.join(",");
  const seen = new Map<string, { parent: string | null; move: Move | null }>();
  seen.set(startKey, { parent: null, move: null });
  let frontier: number[][] = [start];
  let depth = 0;
  let visited = 0;

  while (frontier.length && visited < limit) {
    const next: number[][] = [];
    depth++;
    for (const cur of frontier) {
      const curKey = cur.join(",");
      for (const n of neighbors(vs, cur)) {
        const k = n.pos.join(",");
        if (seen.has(k)) continue;
        seen.set(k, { parent: curKey, move: n.move });
        visited++;
        if (n.pos[0] === goal) {
          // walk back to the first move of the optimal path
          let key = k;
          let first = n.move;
          while (true) {
            const node = seen.get(key)!;
            if (node.parent === null || node.parent === startKey) {
              first = node.move ?? first;
              break;
            }
            first = node.move ?? first;
            key = node.parent;
          }
          return { moves: depth, first };
        }
        next.push(n.pos);
      }
    }
    frontier = next;
  }
  return { moves: -1, first: null };
}

const RANGES: Record<Difficulty, [number, number]> = {
  easy: [4, 9],
  medium: [10, 17],
  hard: [16, 24],
  extra: [25, 34],
  ultra: [35, 80],
};

const COUNTS: Record<Difficulty, [number, number]> = {
  easy: [5, 8],
  medium: [8, 11],
  hard: [10, 13],
  extra: [10, 13],
  ultra: [11, 13],
};

function randomLayout(rng: () => number, difficulty: Difficulty): Vehicle[] | null {
  const vs: Vehicle[] = [];
  const grid = new Int8Array(SIZE * SIZE).fill(-1);

  const place = (row: number, col: number, len: number, orient: Orient, target: boolean) => {
    for (let k = 0; k < len; k++) {
      const r = orient === "h" ? row : row + k;
      const c = orient === "h" ? col + k : col;
      if (r >= SIZE || c >= SIZE || grid[r * SIZE + c] !== -1) return false;
    }
    const id = vs.length;
    for (let k = 0; k < len; k++) {
      const r = orient === "h" ? row : row + k;
      const c = orient === "h" ? col + k : col;
      grid[r * SIZE + c] = id;
    }
    vs.push({
      id,
      row,
      col,
      len,
      orient,
      target,
      sprite: "",
    });
    return true;
  };

  // Target car always on the exit row, never already free.
  const startCol = Math.floor(rng() * 3);
  place(EXIT_ROW, startCol, 2, "h", true);

  // Seed vertical blockers across the exit lane so the board is never trivial.
  const wantedBlockers = difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3;
  const lanes: number[] = [];
  for (let c = startCol + 2; c < SIZE; c++) lanes.push(c);
  for (let i = lanes.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [lanes[i], lanes[j]] = [lanes[j]!, lanes[i]!];
  }
  let blockersPlaced = 0;
  for (const c of lanes) {
    if (blockersPlaced >= wantedBlockers) break;
    const len = rng() < 0.4 ? 3 : 2;
    const lowest = Math.max(0, EXIT_ROW - len + 1);
    const highest = Math.min(EXIT_ROW, SIZE - len);
    const row = lowest + Math.floor(rng() * (highest - lowest + 1));
    if (place(row, c, len, "v", false)) blockersPlaced++;
  }
  if (blockersPlaced === 0) return null;

  const [minC, maxC] = COUNTS[difficulty];
  const wanted = minC + Math.floor(rng() * (maxC - minC + 1));
  let guard = 0;
  while (vs.length < wanted + 1 + blockersPlaced && guard < 400) {
    guard++;
    const orient: Orient = rng() < 0.5 ? "h" : "v";
    const len = rng() < (difficulty === "easy" ? 0.25 : 0.33) ? 3 : 2;
    const row = Math.floor(rng() * SIZE);
    const col = Math.floor(rng() * SIZE);
    if (orient === "h" && row === EXIT_ROW) continue; // keep the exit lane for blockers only
    if (orient === "h" && col + len > SIZE) continue;
    if (orient === "v" && row + len > SIZE) continue;
    place(row, col, len, orient, false);
  }

  // Require at least one blocker in front of the target car.
  let blocked = false;
  for (let c = startCol + 2; c < SIZE; c++) {
    if (grid[EXIT_ROW * SIZE + c] !== -1) blocked = true;
  }
  if (!blocked) return null;
  return vs;
}

export interface GeneratedLevel {
  vehicles: Vehicle[];
  optimalMoves: number;
}

const SEED: Record<Difficulty, number> = { easy: 4, medium: 6, hard: 4, extra: 5, ultra: 7 };

function generateRaw(level: number, difficulty: Difficulty): GeneratedLevel {
  const seedBase = (level * 2654435761 + SEED[difficulty] * 977) >>> 0;
  const [lo, hi] = RANGES[difficulty];
  let best: GeneratedLevel | null = null;

  const deadline = Date.now() + (difficulty === "extra" || difficulty === "ultra" ? 3500 : 2000);
  for (let attempt = 0; attempt < 1500; attempt++) {
    const rng = mulberry32((seedBase + attempt * 7919) >>> 0);
    const layout = randomLayout(rng, difficulty);
    if (!layout) continue;
    const { moves } = solve(layout);
    if (moves <= 0) continue;
    if (moves >= lo && moves <= hi) return { vehicles: layout, optimalMoves: moves };
    // keep the hardest board seen so far as a fallback
    if (!best || moves > best.optimalMoves) best = { vehicles: layout, optimalMoves: moves };
    if (Date.now() > deadline && best) break;
  }

  if (best) return best;
  // Extremely unlikely fallback: a simple hand-made board.
  const fallback: Vehicle[] = [
    { id: 0, row: 2, col: 0, len: 2, orient: "h", sprite: "", target: true },
    { id: 1, row: 0, col: 3, len: 3, orient: "v", sprite: "", target: false },
    { id: 2, row: 3, col: 1, len: 2, orient: "h", sprite: "", target: false },
  ];
  return { vehicles: fallback, optimalMoves: solve(fallback).moves };
}

export function generateLevel(level: number, difficulty: Difficulty): GeneratedLevel {
  const g = generateRaw(level, difficulty);
  const rng = mulberry32((level * 31 + SEED[difficulty]) >>> 0);
  const used = new Set<string>();
  const vehicles = g.vehicles.map((v) => ({
    ...v,
    sprite: v.target ? TARGET_SPRITE : pickSprite(v.len, rng, used),
  }));
  return { ...g, vehicles };
}