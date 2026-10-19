/**
 * The official Palm Bite wordmark, vector-traced from the supplied logo and
 * rendered as a mask so it takes the current text colour without changing
 * its shapes or proportions.
 */
const WORDMARK_RATIO = 3114 / 972;
const MARK_RATIO = 568 / 930;

export function Wordmark({ height = 32, className = "" }: { height?: number; className?: string }) {
  return (
    <span
      role="img"
      aria-label="Palm Bite"
      className={`logo-mask ${className}`}
      style={{
        height,
        width: Math.round(height * WORDMARK_RATIO),
        WebkitMaskImage: "url(/brand/palmbite-wordmark.svg)",
        maskImage: "url(/brand/palmbite-wordmark.svg)",
      }}
    />
  );
}

export function Mark({ height = 32, className = "", label = "Palm Bite" }: { height?: number; className?: string; label?: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      className={`logo-mask ${className}`}
      style={{
        height,
        width: Math.round(height * MARK_RATIO),
        WebkitMaskImage: "url(/brand/palmbite-mark.svg)",
        maskImage: "url(/brand/palmbite-mark.svg)",
      }}
    />
  );
}
