import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/menu"), lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: absoluteUrl("/community"), lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: absoluteUrl("/join"), lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];
}
