import { menuArtSvg, ART_STYLES } from "./lib/brand/menu-art.ts";
import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";
const colors = { iced:"#7FC6C2", frappe:"#8B6A4F", juice:"#E8C547", hot:"#D2B48C", plate:"#E8A53A", salad:"#7DAA5A", waffle:"#D9A45B", cake:"#5A3428", bread:"#8A5A3C", croissant:"#D9A45B", pizza:"#D9533A", pie:"#C98B4A", wrap:"#D9A45B", sandwich:"#C99A5B", combo:"#9DB27C", tee:"#1D2119", tote:"#1D2119", cap:"#1D2119" };
const cols = 6, w = 250, h = 330;
const cells = ART_STYLES.map((s, i) => `<g transform="translate(${(i % cols) * w} ${Math.floor(i / cols) * h})"><rect width="240" height="320" rx="20" fill="${colors[s]}" fill-opacity="0.2"/>${menuArtSvg({ art: s, accent: colors[s], idSuffix: s }).replace(/<svg[^>]*>/, "").replace("</svg>", "")}</g>`).join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * w}" height="${Math.ceil(ART_STYLES.length / cols) * h}"><rect width="100%" height="100%" fill="#F6F1E7"/>${cells}</svg>`;
fs.writeFileSync(process.argv[2], new Resvg(svg).render().asPng());
