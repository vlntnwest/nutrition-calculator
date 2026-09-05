export function SpinnerGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="size-6 animate-spin"
      aria-hidden="true"
    >
      <circle
        cx={12}
        cy={12}
        r={9}
        stroke="currentColor"
        strokeWidth={1.6}
        strokeOpacity={0.25}
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </svg>
  );
}
