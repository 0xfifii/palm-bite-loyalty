import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
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
