import { drinkSvg } from "@/lib/brand/drink-art";

/**
 * Shows the drink's uploaded photograph when there is one, otherwise the
 * original Palm Bite illustration in the drink's accent colour.
 */
export function DrinkImage({
  name,
  imageUrl,
  accent,
  id,
  className = "",
  priority = false,
}: {
  name: string;
  imageUrl: string | null;
  accent: string;
  id: string;
  className?: string;
  priority?: boolean;
}) {
  if (imageUrl && imageUrl.startsWith("https://")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={name}
      className={`h-full w-full [&>svg]:h-full [&>svg]:w-full ${className}`}
      dangerouslySetInnerHTML={{ __html: drinkSvg({ accent, idSuffix: id.replace(/-/g, "").slice(0, 10) }) }}
    />
  );
}
