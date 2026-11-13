import { menuArtSvg } from "@/lib/brand/menu-art";

/**
 * Shows the item's uploaded photograph when there is one, otherwise the
 * original animated Palm Bite illustration for its art style and colour.
 */
export function DrinkImage({
  name,
  imageUrl,
  accent,
  id,
  art = "iced",
  className = "",
  priority = false,
}: {
  name: string;
  imageUrl: string | null;
  accent: string;
  id: string;
  art?: string | null;
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
      dangerouslySetInnerHTML={{ __html: menuArtSvg({ art, accent, idSuffix: id.replace(/-/g, "").slice(0, 10) }) }}
    />
  );
}
