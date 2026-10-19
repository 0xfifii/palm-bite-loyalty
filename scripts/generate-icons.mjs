// Generates PWA icons from the traced Palm Bite "P" mark.
// Usage: npm run icons
import fs from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const mark = fs.readFileSync(path.join(root, "public/brand/palmbite-mark.svg"), "utf8");
const inner = mark.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").replaceAll("currentColor", "#EECFBA");
const OLIVE = "#5D724B";
const W = 568;
const H = 930;

function iconSvg(size, markScale, rounded) {
  const markH = size * markScale;
  const markW = (markH * W) / H;
  const x = (size - markW) / 2;
  const y = (size - markH) / 2;
  const r = rounded ? size * 0.22 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<rect width="${size}" height="${size}" rx="${r}" fill="${OLIVE}"/>
<svg x="${x}" y="${y}" width="${markW}" height="${markH}" viewBox="0 0 ${W} ${H}">${inner}</svg>
</svg>`;
}

const out = path.join(root, "public/icons");
fs.mkdirSync(out, { recursive: true });
const render = (svg) => new Resvg(svg).render().asPng();

fs.writeFileSync(path.join(out, "icon-192.png"), render(iconSvg(192, 0.62, false)));
fs.writeFileSync(path.join(out, "icon-512.png"), render(iconSvg(512, 0.62, false)));
fs.writeFileSync(path.join(out, "icon-maskable-512.png"), render(iconSvg(512, 0.46, false)));
fs.writeFileSync(path.join(out, "apple-touch-icon.png"), render(iconSvg(180, 0.6, false)));
fs.writeFileSync(path.join(out, "icon.svg"), iconSvg(512, 0.62, true));
fs.writeFileSync(path.join(root, "app/icon.png"), render(iconSvg(48, 0.66, true)));
console.log("Icons written to public/icons");
