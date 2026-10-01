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
          target
            ? "drop-shadow-[0_0_8px_rgba(255,60,60,0.85)]"
            : "drop-shadow-[0_3px_6px_rgba(0,0,0,0.45)]",
        ].join(" ")}
      />
      {target && (
        <svg
          viewBox="0 0 24 24"
          className="absolute left-1/2 top-1/2 h-1/3 -translate-x-1/2 -translate-y-1/2"
          fill="none"
          stroke="var(--car-arrow, #fff)"
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 5l7 7-7 7" />
        </svg>
      )}
    </div>
  );
}