import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Palm Bite Cafe",
    short_name: "Palm Bite",
    description: "Palm Bite Cafe, a social community cafe. Order, join our clubs and earn a free drink every fifteen visits.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#5d724b",
    theme_color: "#5d724b",
    categories: ["food", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Scan and earn", url: "/scan", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "My rewards", url: "/rewards", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
