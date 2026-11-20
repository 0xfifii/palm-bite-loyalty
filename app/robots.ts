import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { BLOCKED_BOTS } from "@/lib/bots";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // AI crawlers and scrapers: no access at all.
      { userAgent: BLOCKED_BOTS, disallow: ["/"] },
      {
        userAgent: "*",
        allow: ["/", "/menu", "/community", "/join"],
        disallow: ["/admin", "/staff", "/api", "/display", "/home", "/notifications", "/rewards", "/orders", "/order", "/profile", "/scan", "/auth", "/reset-password", "/check-email", "/suspended"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
