/**
 * Renders the 3D-look menu pictures in public/art from the Palm Bite
 * illustrations (lib/brand/menu-art.ts) with light, gloss and texture.
 * The images are already in the project; run this only after changing the
 * art or adding items to scripts/menu-art-items.json:
 *
 *   npx tsx scripts/render-menu-art.ts
 *
 * Needs Playwright with Chromium (npx playwright install chromium).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { menuArtSvg } from "../lib/brand/menu-art";
import { artSlug } from "../lib/brand/art-images";

type Item = { name: string; art: string; accent: string };

const FILTER = `<filter id="puff" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
<feGaussianBlur in="SourceAlpha" stdDeviation="5" result="form"/>
<feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.35 0.55 0.1 0 0" result="lum"/>
<feGaussianBlur in="lum" stdDeviation="1.6" result="lumB"/>
<feComposite in="form" in2="lumB" operator="arithmetic" k2="0.75" k3="0.45" result="bump"/>
<feDiffuseLighting in="bump" surfaceScale="6" diffuseConstant="1.25" lighting-color="#fff" result="d"><feDistantLight azimuth="235" elevation="50"/></feDiffuseLighting>
<feSpecularLighting in="bump" surfaceScale="6" specularConstant="0.75" specularExponent="24" lighting-color="#FFF8EA" result="s"><feDistantLight azimuth="235" elevation="55"/></feSpecularLighting>
<feComposite in="SourceGraphic" in2="d" operator="arithmetic" k1="1.0" k2="0.12" result="lit"/>
<feComposite in="s" in2="SourceAlpha" operator="in" result="sIn"/>
<feComposite in="lit" in2="sIn" operator="arithmetic" k2="1" k3="0.42" result="glow"/>
<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" result="n"/>
<feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.09 0" result="grain"/>
<feComposite in="grain" in2="SourceAlpha" operator="in" result="gIn"/>
<feMerge><feMergeNode in="glow"/><feMergeNode in="gIn"/></feMerge>
<feComposite in2="SourceAlpha" operator="in"/>
</filter>`;

const STEAM = /<g fill="none" stroke="#ffffff" stroke-width="5"[\s\S]*?<\/g>/g;

function richSvg(item: Item, i: number): string {
  let inner = menuArtSvg({ art: item.art, accent: item.accent, idSuffix: `r${i}` })
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>$/, "")
    .replace(/<ellipse class="pb-shadow"[^>]*\/>/g, "")
    .replace(/ class="pb-[a-z]+"/g, "");
  const steam = (inner.match(STEAM) ?? []).join("");
  inner = inner.replace(STEAM, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 320" width="240" height="320"><defs>${FILTER}</defs><g filter="url(#puff)">${inner}</g>${steam}</svg>`;
}

async function main() {
  const root = process.cwd();
  const items: Item[] = JSON.parse(readFileSync(join(root, "scripts/menu-art-items.json"), "utf8"));
  const out = join(root, "public/art");
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 240, height: 320 }, deviceScaleFactor: 2.5 });
  for (const [i, item] of items.entries()) {
    await page.setContent(`<html><body style="margin:0;background:transparent">${richSvg(item, i)}</body></html>`);
    const file = join(out, `${artSlug(item.name)}.png`);
    writeFileSync(file, await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: 240, height: 320 } }));
    console.log(`Rendered ${item.name}`);
  }
  await browser.close();
}

main();
