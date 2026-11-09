export function Sun({ className = "sun" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd166" />
          <stop offset="1" stopColor="#ff8e5e" />
        </linearGradient>
      </defs>
      <g stroke="url(#sg)" strokeWidth="2.2" strokeLinecap="round">
        <path d="M16 3v3M5.5 8l2 2M26.5 8l-2 2M2 18h3M27 18h3" />
      </g>
      <path d="M7 24a9 9 0 0 1 18 0z" fill="url(#sg)" />
      <path d="M4 27h24" stroke="url(#sg)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
