interface CarSpriteProps {
  sprite: string;
  target: boolean;
}

/** Image vehicle, stretched to fill its slot. The board rotates the wrapper for vertical lanes. */
export function CarSprite({ sprite, target }: CarSpriteProps) {
  return (
    <div className="relative h-full w-full">
      <img
        src={sprite}
        alt=""
        draggable={false}
        className={[
          "pointer-events-none block h-full w-full select-none object-contain",
          "drop-shadow-[0_2px_3px_rgba(0,0,0,0.18)]",
        ].join(" ")}
      />
      {target && (
  <div
    className={[
      "absolute left-1/2 top-1/2 flex aspect-square h-[46%] -translate-x-1/2 -translate-y-1/2",
      "items-center justify-center rounded-full bg-black/30 backdrop-blur-[1px]",
      "shadow-[0_0_0_1.5px_rgba(255,255,255,0.6),0_2px_6px_rgba(0,0,0,0.35)]",
    ].join(" ")}
  >
    <svg
      viewBox="0 0 24 24"
      className="h-[62%] w-[62%]"
      fill="none"
      stroke="var(--car-arrow, #fff)"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  </div>
)}
    </div>
  );
}