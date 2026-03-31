export function Logo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      className={className}
    >
      <circle cx="32" cy="32" r="32" className="fill-foreground" />

      <g
        transform="translate(14, 12)"
        fill="none"
        className="stroke-background"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="5" y="6" width="26" height="30" rx="3" />

        <path d="M 13 6 V 4 C 13 2.895 13.895 2 15 2 H 21 C 22.105 2 23 2.895 23 4 V 6" />

        <rect
          x="11"
          y="4"
          width="14"
          height="6"
          rx="1.5"
          className="fill-foreground stroke-background"
        />

        <circle
          cx="18"
          cy="7"
          r="1"
          className="fill-background"
          stroke="none"
        />

        <line x1="12" y1="18" x2="24" y2="18" />
        <line x1="12" y1="24" x2="24" y2="24" />
        <line x1="12" y1="30" x2="24" y2="30" />
      </g>
    </svg>
  )
}
