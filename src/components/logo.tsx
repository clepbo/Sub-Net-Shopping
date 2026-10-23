export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#facc15" />
      <path d="M14 20h6l5 22h20l5-15H23" fill="none" stroke="#14532d" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="27" cy="49" r="3.5" fill="#14532d" />
      <circle cx="43" cy="49" r="3.5" fill="#14532d" />
    </svg>
  );
}
