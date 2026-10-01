export interface Sprite {
  src: string;
  /** Board cells the vehicle occupies (2 or 3). */
  len: number;
}

/** Red car, nose pointing right (toward the exit). */
export const TARGET_SPRITE = "/vehicles/red-sedan.webp";

/**
 * Blocker pool: plain top-down civilian vehicles only (no emergency, bus, camper,
 * motorcycle, tiny or slanted-perspective sprites). Each is stretched to fill its slot.
 */
export const SPRITES: Sprite[] = [
  { src: "/vehicles/green-pickup.webp", len: 3 },
  { src: "/vehicles/orange-box-truck.webp", len: 3 },
  { src: "/vehicles/white-suv.webp", len: 3 },
  { src: "/vehicles/blue-sedan.webp", len: 2 },
  { src: "/vehicles/purple-suv.webp", len: 2 },
  { src: "/vehicles/gray-sedan.webp", len: 2 },
  { src: "/vehicles/blue-pickup.webp", len: 2 },
  { src: "/vehicles/white-wagon.webp", len: 2 },
  { src: "/vehicles/yellow-hatch.webp", len: 2 },
  { src: "/vehicles/green-hatch.webp", len: 2 },
  { src: "/vehicles/white-van.webp", len: 2 },
  { src: "/vehicles/gray-pickup.webp", len: 2 },
  { src: "/vehicles/orange-suv.webp", len: 2 },
  { src: "/vehicles/purple-sedan.webp", len: 2 },
  { src: "/vehicles/tan-pickup.webp", len: 2 },
  { src: "/vehicles/blue-compact.webp", len: 2 },

  { src: "/vehicles/orange-sports.webp", len: 2 },
  { src: "/vehicles/blue-cab-truck.webp", len: 2 },
  { src: "/vehicles/green-pickup-2.webp", len: 2 },
  { src: "/vehicles/white-van-2.webp", len: 2 },
  
];

export function pickSprite(len: number, rng: () => number, used: Set<string>) {
  const pool = SPRITES.filter((s) => s.len === len);
  const fresh = pool.filter((s) => !used.has(s.src));
  const list = fresh.length ? fresh : pool;
  const s = list[Math.floor(rng() * list.length)]!;
  used.add(s.src);
  return s.src;
}

if (typeof window !== "undefined") {
  for (const s of [TARGET_SPRITE, ...SPRITES.map((x) => x.src)]) new Image().src = s;
}
