/**
 * 3D-look menu pictures rendered by scripts/render-menu-art.ts into
 * public/art. Items without a photo use one of these when it exists, and
 * fall back to the live illustration otherwise (for example a brand new
 * item added in Admin).
 */
import items from "@/scripts/menu-art-items.json";

export function artSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const RENDERED = new Set(items.map((i) => artSlug(i.name)));

export function renderedArt(name: string): string | null {
  const slug = artSlug(name);
  return RENDERED.has(slug) ? `/art/${slug}.webp` : null;
}
