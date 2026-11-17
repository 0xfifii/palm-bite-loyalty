/**
 * Search and sharing details for Palm Bite Cafe. The site address comes from
 * NEXT_PUBLIC_SITE_URL (set it to https://palmbitecafe.app in Vercel).
 */
import { SOCIAL } from "@/lib/brand/social";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://palmbitecafe.app").replace(/\/$/, "");
export const SITE_NAME = "Palm Bite Cafe";
export const TAGLINE = "A social community cafe";
export const SITE_DESCRIPTION =
  "Palm Bite is a social community cafe in Ekiti serving signature coffee Gems, fresh juice, Slab and pastries. Join the Palm Fitness Club and Palm Book Club, order on WhatsApp and earn a free drink every fifteen visits.";
export const KEYWORDS = [
  "Palm Bite",
  "Palm Bite Cafe",
  "palmbitecafe",
  "social community cafe",
  "community cafe Ekiti",
  "cafe in Ekiti",
  "coffee shop Ekiti",
  "iced coffee",
  "matcha",
  "frappuccino",
  "fresh juice",
  "hibiscus juice",
  "pastries",
  "meat pie",
  "croissant",
  "book club",
  "fitness club",
  "Palm Bite loyalty",
];

export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export const SAME_AS = [SOCIAL.instagram, SOCIAL.tiktok].filter(Boolean);
