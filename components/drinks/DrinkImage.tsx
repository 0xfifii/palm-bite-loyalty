import { menuArtSvg } from "@/lib/brand/menu-art";
import { renderedArt } from "@/lib/brand/art-images";

/**
 * Shows the item's photograph when there is one, then its 3D-look floating
 * picture (public/art), then the live animated illustration for its art
 * style and colour.
 */
export function DrinkImage({
  name,
  imageUrl,
  accent,
  id,
  art = "iced",
  fit = "cover",
  className = "",
  priority = false,
}: {
  name: string;
  imageUrl: string | null;
  accent: string;
  id: string;
  art?: string | null;
  fit?: "cover" | "contain";
  className?: string;
  priority?: boolean;
}) {
  if (imageUrl && (imageUrl.startsWith("https://") || imageUrl.startsWith("/photos/"))) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className={`h-full w-full ${fit === "contain" ? "object-contain" : "object-cover"} ${className}`}
      />
    );
  }
  const art3d = renderedArt(name);
  if (art3d) {
    return (
      <div role="img" aria-label={name} className={`pb-art relative h-full w-full ${className}`}>
        <span aria-hidden="true" className="pb-art-shadow absolute bottom-[5%] left-[22%] h-[5%] w-[56%] rounded-[50%] bg-ink/25 blur-[6px]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={art3d}
          alt=""
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className="pb-art-float relative h-full w-full object-contain"
        />
      </div>
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
