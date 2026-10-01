const STARS = Array.from({ length: 12 }).map((_, i) => ({
  id: i,
  left: (i * 37) % 95,
  top: (i * 53) % 90,
  delay: (i % 7) * 0.09,
  scale: 0.6 + ((i * 13) % 9) / 10,
  violet: i % 3 === 0,
}));

export function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {STARS.map((s) => (
        <svg
          key={s.id}
          viewBox="0 0 24 24"
          className="absolute h-4 w-4 animate-star-pop"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            animationDelay: `${s.delay}s`,
            transform: `scale(${s.scale})`,
            color: "var(--star-gold)",
          }}
        >
          <path
            fill="currentColor"
            d="M12 1.6l2.9 6.1 6.7.9-4.9 4.6 1.2 6.6L12 16.7 6.1 19.8l1.2-6.6L2.4 8.6l6.7-.9z"
          />
        </svg>
      ))}
    </div>
  );
}