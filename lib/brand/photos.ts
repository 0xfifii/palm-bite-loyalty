/**
 * Real Palm Bite photos shipped with the app (public/photos). An item uses
 * its uploaded photo first (Admin > Menu & merch), then one of these, then
 * its animated illustration.
 */
const BUILT_IN: Record<string, string> = {
  "palm way our way tee": "/photos/tee-palm-way-our-way.jpg",
  "palm state of mind tee": "/photos/tee-palm-state-of-mind.jpg",
  "palm community cap": "/photos/cap.jpg",
  "palm tote": "/photos/tote.jpg",
  "crips love": "/photos/crips-love.jpg",
  "mint tea": "/photos/mint-tea.jpg",
  "palms frappuccino": "/photos/palms-frappuccino.jpg",
  melis: "/photos/melis.jpg",
  // Our Picks combos lead with their drink's photo.
  "palms frappuccino + plantain medley": "/photos/palms-frappuccino.jpg",
  "chicken salad + melis": "/photos/melis.jpg",
};

export function builtInPhoto(name: string): string | null {
  return BUILT_IN[name.trim().toLowerCase()] ?? null;
}

export function withPhoto<T extends { name: string; image_url: string | null }>(item: T): T {
  return item.image_url ? item : { ...item, image_url: builtInPhoto(item.name) };
}
