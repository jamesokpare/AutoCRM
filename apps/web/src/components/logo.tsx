import type { SVGProps } from "react";

/**
 * Drivewell brand mark: a gradient badge with a stylized "W" set against the
 * pink→purple gradient used across Drivewell branding.
 */
export function DrivewellMark({
  className,
  title = "Drivewell",
  ...props
}: SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label={title}
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id="drivewell-mark" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FF4D8D" />
          <stop offset="55%" stopColor="#E0479B" />
          <stop offset="100%" stopColor="#6C5CE7" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="url(#drivewell-mark)" />
      <path
        d="M26 34 C26 60 38 70 50 52 C62 70 74 60 74 34"
        fill="none"
        stroke="#ffffff"
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Full Drivewell lockup: brand mark + wordmark sized to match the lettering,
 * suitable for the dashboard sidebar header.
 */
export function DrivewellLogo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={`flex items-center gap-2 ${className ?? ""}`}>
      <DrivewellMark className="size-7 shrink-0" />
      {showWordmark && (
        <span className="text-lg font-bold leading-none tracking-tight text-foreground">
          Drivewell
        </span>
      )}
    </span>
  );
}
