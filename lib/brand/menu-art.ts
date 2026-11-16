/**
 * Original, animated Palm Bite illustrations for every menu item, drawn as
 * SVG from an art style and one accent colour. Used whenever an item has no
 * uploaded photograph. Animations are CSS classes defined in globals.css
 * (pb-float, pb-bob, pb-steam, pb-bubble, pb-sway, pb-drip, pb-twinkle) and
 * switch off automatically for people who prefer reduced motion.
 * Pure function: safe on server and client.
 */
import { mix } from "./drink-art";

export const ART_STYLES = [
  "iced", "frappe", "juice", "hot", "plate", "salad", "waffle", "cake", "bread",
  "croissant", "pizza", "pie", "wrap", "sandwich", "combo", "tee", "tote", "cap",
] as const;
export type ArtStyle = (typeof ART_STYLES)[number];

export const ART_LABELS: Record<ArtStyle, string> = {
  iced: "Iced drink", frappe: "Frappe with cream", juice: "Fresh juice", hot: "Hot coffee",
  plate: "Plated dish", salad: "Salad bowl", waffle: "Waffles", cake: "Cake slice", bread: "Loaf",
  croissant: "Croissant", pizza: "Pizza", pie: "Meat pie", wrap: "Shawarma wrap", sandwich: "Sandwich",
  combo: "Drink and food combo", tee: "T-shirt", tote: "Tote bag", cap: "Cap",
};

const HEX = /^#[0-9a-f]{6}$/i;
const INK = "#1D2119";
const CREAM = "#FBF7EE";
const PEACH = "#EECFBA";
const OLIVE = "#34432A";

type Ctx = { a: string; id: string; deep: string; light: string; pale: string };

const shadow = (cx = 120, cy = 304, rx = 78) => `<ellipse class="pb-shadow" cx="${cx}" cy="${cy}" rx="${rx}" ry="8" fill="${INK}" opacity="0.14"/>`;

const steam = (xs: number[], y: number) =>
  `<g fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity="0.9">${xs
    .map((x, i) => `<path class="pb-steam" style="animation-delay:${i * 0.7}s" d="M${x} ${y} c-10 -14 10 -22 0 -36 c-10 -14 10 -22 0 -34"/>`)
    .join("")}</g>`;

const bubbles = (pts: [number, number, number][]) =>
  `<g fill="#ffffff" opacity="0.8">${pts
    .map(([x, y, r], i) => `<circle class="pb-bubble" style="animation-delay:${(i * 0.45).toFixed(2)}s" cx="${x}" cy="${y}" r="${r}"/>`)
    .join("")}</g>`;

const sparkles = (pts: [number, number][]) =>
  `<g fill="${PEACH}">${pts
    .map(([x, y], i) => `<path class="pb-twinkle" style="animation-delay:${i * 0.6}s" d="M${x} ${y - 9} L${x + 3} ${y - 3} L${x + 9} ${y} L${x + 3} ${y + 3} L${x} ${y + 9} L${x - 3} ${y + 3} L${x - 9} ${y} L${x - 3} ${y - 3} Z"/>`)
    .join("")}</g>`;

/** The bitten P, as a small badge. */
const badge = (x: number, y: number, r: number, fg: string, bg: string) =>
  `<g transform="translate(${x} ${y})"><circle r="${r}" fill="${bg}"/><path d="M${-r * 0.32} ${r * 0.55} V${-r * 0.5} H${r * 0.08} A${r * 0.34} ${r * 0.34} 0 0 1 ${r * 0.08} ${r * 0.18} H${-r * 0.32}" fill="none" stroke="${fg}" stroke-width="${r * 0.24}" stroke-linecap="round" stroke-linejoin="round"/></g>`;

// ---------------------------------------------------------------------------
// Drinks
// ---------------------------------------------------------------------------
function iced({ a, id, deep, pale, light }: Ctx, topping = false) {
  return `<defs>
<clipPath id="cup-${id}"><path d="M52 92 L188 92 L172 286 Q171 298 159 298 L81 298 Q69 298 68 286 Z"/></clipPath>
<linearGradient id="liq-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${deep}"/><stop offset="0.55" stop-color="${a}"/><stop offset="1" stop-color="${a}"/></linearGradient>
<linearGradient id="gl-${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0.55"/><stop offset="0.2" stop-color="#fff" stop-opacity="0.1"/><stop offset="0.8" stop-color="#fff" stop-opacity="0.05"/><stop offset="1" stop-color="#fff" stop-opacity="0.35"/></linearGradient>
</defs>
${shadow()}
<g class="pb-float">
<g transform="rotate(14 145 83)"><rect class="pb-sway" x="138" y="${topping ? 0 : 8}" width="14" height="150" rx="7" fill="${OLIVE}"/></g>
<g clip-path="url(#cup-${id})">
<rect x="40" y="88" width="160" height="220" fill="${pale}"/>
<path d="M40 86 L200 86 L200 196 C176 214 160 182 136 200 C112 218 96 188 72 206 C58 216 48 206 40 210 Z" fill="url(#liq-${id})"/>
<path class="pb-drip" d="M60 214 C84 200 98 226 122 212 C146 198 160 222 186 208" stroke="${light}" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.75"/>
<g class="pb-bob" fill="#fff" fill-opacity="0.42" stroke="#fff" stroke-opacity="0.9" stroke-width="2">
<rect x="62" y="98" width="38" height="36" rx="9" transform="rotate(-12 81 114)"/>
<rect x="104" y="94" width="40" height="38" rx="9" transform="rotate(8 124 111)"/>
<rect x="146" y="102" width="34" height="34" rx="8" transform="rotate(-6 163 117)"/>
<rect x="86" y="136" width="34" height="32" rx="8" transform="rotate(16 101 150)"/>
</g>
${bubbles([[164, 250, 2.6], [150, 270, 2], [90, 262, 2.2], [120, 280, 1.8], [174, 220, 2]])}
</g>
<path d="M52 92 L188 92 L172 286 Q171 298 159 298 L81 298 Q69 298 68 286 Z" fill="url(#gl-${id})" stroke="#fff" stroke-opacity="0.95" stroke-width="2.5"/>
${topping
  ? `<path d="M50 92 C50 52 82 40 96 52 C104 26 140 24 148 50 C164 40 192 56 190 92 Z" fill="${CREAM}" stroke="#fff" stroke-width="2"/>
<path class="pb-drip" d="M70 70 L86 58 L100 72 L116 56 L132 72 L148 58 L166 72" stroke="${deep}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="120" cy="34" r="9" fill="#B5354A"/>`
  : `<path d="M44 82 Q44 74 52 74 L188 74 Q196 74 196 82 L196 86 Q196 94 188 94 L52 94 Q44 94 44 86 Z" fill="#fff" fill-opacity="0.55" stroke="#fff" stroke-width="2"/>`}
<rect x="62" y="104" width="7" height="170" rx="3.5" fill="#fff" opacity="0.45"/>
</g>`;
}

function juice({ a, id, deep, light }: Ctx) {
  const drops: [number, number, number][] = [[80, 160, 3], [160, 200, 2.6], [88, 236, 2.2], [154, 150, 2], [104, 268, 2.4]];
  return `<defs><clipPath id="jg-${id}"><path d="M66 96 L174 96 L166 280 Q165 294 151 294 L89 294 Q75 294 74 280 Z"/></clipPath>
<linearGradient id="jl-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="0.6" stop-color="${a}"/><stop offset="1" stop-color="${deep}"/></linearGradient>
<linearGradient id="jsh-${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0.5"/><stop offset="0.25" stop-color="#fff" stop-opacity="0.05"/><stop offset="0.85" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0.3"/></linearGradient></defs>
${shadow(120, 306, 62)}
<g class="pb-float">
<g transform="rotate(12 132 93)"><rect class="pb-sway" x="126" y="18" width="12" height="150" rx="6" fill="${OLIVE}"/></g>
<g clip-path="url(#jg-${id})">
<rect x="60" y="112" width="120" height="190" fill="url(#jl-${id})"/>
<path d="M60 112 C84 104 100 120 124 112 C148 104 162 118 182 110 L182 96 L60 96 Z" fill="#fff" opacity="0.25"/>
<g class="pb-bob" fill="#fff" fill-opacity="0.35" stroke="#fff" stroke-opacity="0.9" stroke-width="2">
<rect x="78" y="112" width="34" height="32" rx="8" transform="rotate(-10 95 128)"/>
<rect x="118" y="116" width="32" height="30" rx="8" transform="rotate(12 134 131)"/>
<rect x="96" y="146" width="30" height="28" rx="7" transform="rotate(4 111 160)"/>
</g>
${bubbles([[90, 270, 3], [110, 250, 2.4], [140, 276, 2.8], [150, 230, 2], [96, 210, 2.2], [130, 190, 2.6]])}
</g>
<path d="M66 96 L174 96 L166 280 Q165 294 151 294 L89 294 Q75 294 74 280 Z" fill="url(#jsh-${id})" stroke="#fff" stroke-width="3"/>
<g fill="#fff" opacity="0.75">${drops.map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 1.4}"/>`).join("")}</g>
<g transform="translate(172 100)"><g class="pb-bob">
<circle r="30" fill="${deep}"/><circle r="26" fill="${light}"/><circle r="22" fill="${a}"/>
<g stroke="${light}" stroke-width="3">${[0, 45, 90, 135].map((d) => `<path d="M0 0 L${(22 * Math.cos((d * Math.PI) / 180)).toFixed(1)} ${(22 * Math.sin((d * Math.PI) / 180)).toFixed(1)} M0 0 L${(-22 * Math.cos((d * Math.PI) / 180)).toFixed(1)} ${(-22 * Math.sin((d * Math.PI) / 180)).toFixed(1)}"/>`).join("")}</g>
<circle r="4" fill="${light}"/>
</g></g>
</g>`;
}

function hot({ a, id, deep, light }: Ctx) {
  return `<defs>
<linearGradient id="cup-${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#E9E2D3"/><stop offset="0.3" stop-color="#fff"/><stop offset="0.75" stop-color="#F5F0E4"/><stop offset="1" stop-color="#D8CFBC"/></linearGradient>
<radialGradient id="cof-${id}" cx="0.5" cy="0.5" r="0.6"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${deep}"/></radialGradient>
</defs>
${shadow(120, 300, 92)}
<g class="pb-float">
${steam([98, 120, 142], 112)}
<ellipse cx="120" cy="282" rx="96" ry="20" fill="#D8CFBC"/>
<ellipse cx="120" cy="278" rx="96" ry="20" fill="url(#cup-${id})"/>
<ellipse cx="120" cy="276" rx="56" ry="9" fill="#E3DACA"/>
<path d="M178 156 C222 154 222 224 174 226" fill="none" stroke="#E3DACA" stroke-width="18" stroke-linecap="round"/>
<path d="M178 156 C214 156 214 222 174 224" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round"/>
<path d="M56 136 L184 136 L174 248 Q170 276 142 276 L98 276 Q70 276 66 248 Z" fill="url(#cup-${id})"/>
<ellipse cx="120" cy="137" rx="64" ry="16" fill="#E3DACA"/>
<ellipse cx="120" cy="138" rx="57" ry="12.5" fill="url(#cof-${id})"/>
<g class="pb-twinkle" style="animation-duration:5s">
<path d="M120 148 C108 146 100 138 104 132 C108 136 114 138 120 138 C126 138 132 136 136 132 C140 138 132 146 120 148 Z" fill="${light}"/>
<path d="M120 138 C112 136 108 130 112 127 C114 130 117 131 120 131 C123 131 126 130 128 127 C132 130 128 136 120 138 Z" fill="${light}"/>
<path d="M120 130 C115 128 114 124 120 120 C126 124 125 128 120 130 Z" fill="${light}"/>
</g>
<rect x="76" y="160" width="7" height="86" rx="3.5" fill="#fff" opacity="0.9"/>
${badge(138, 206, 17, PEACH, OLIVE)}
</g>`;
}

// ---------------------------------------------------------------------------
// Food
// ---------------------------------------------------------------------------
const flakes = (pts: [number, number, string][]) =>
  pts
    .map(([x, y, c], i) => `<path class="pb-flake" style="animation-delay:${(i * 0.7).toFixed(1)}s" d="M${x} ${y} l6 -3 l3 5 l-5 4 z" fill="${c}"/>`)
    .join("");

const plateBase = (id: string, cy = 230, rx = 104, ry = 40) =>
  `<defs><radialGradient id="pl-${id}" cx="0.5" cy="0.4" r="0.7"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#ECE5D6"/></radialGradient></defs>
<ellipse cx="120" cy="${cy + 6}" rx="${rx}" ry="${ry}" fill="#D9D0BE"/>
<ellipse cx="120" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#pl-${id})"/>
<ellipse cx="120" cy="${cy}" rx="${rx * 0.72}" ry="${ry * 0.68}" fill="#F7F3EA" stroke="#E6DECD" stroke-width="2"/>`;

function plate({ id }: Ctx) {
  // Golden fried plantain (dodo) with peppers and onions.
  const slices: [number, number, number][] = [
    [74, 222, -28], [106, 230, 18], [140, 226, -14], [168, 218, 26], [92, 206, 30], [124, 204, -22], [154, 200, 12], [110, 186, -6], [138, 184, 28],
  ];
  return `<defs><radialGradient id="dodo-${id}" cx="0.45" cy="0.4" r="0.65"><stop offset="0" stop-color="#FFD36A"/><stop offset="0.55" stop-color="#F2A12E"/><stop offset="1" stop-color="#B85A12"/></radialGradient></defs>
${shadow(120, 290, 100)}
<g class="pb-float">
${steam([96, 144], 150)}
${plateBase(id)}
<g>${slices
    .map(
      ([x, y, r]) => `<g transform="rotate(${r} ${x} ${y})"><ellipse cx="${x}" cy="${y + 4}" rx="24" ry="12" fill="#8E400E"/><ellipse cx="${x}" cy="${y}" rx="24" ry="12" fill="url(#dodo-${id})" stroke="#9A4A12" stroke-width="2"/><ellipse cx="${x - 6}" cy="${y - 4}" rx="8" ry="3" fill="#FFF0B8" opacity="0.7"/></g>`,
    )
    .join("")}</g>
<g stroke-linecap="round" stroke-width="5" fill="none"><path d="M80 196 q8 -6 16 -2" stroke="#D63B2E"/><path d="M150 236 q8 -6 16 -2" stroke="#3E8E3E"/><path d="M122 168 q6 -6 14 -4" stroke="#D63B2E"/><path d="M62 236 q8 -4 14 0" stroke="#3E8E3E"/><path d="M176 196 q6 -6 12 -2" stroke="#F2E3B3"/></g>
${sparkles([[40, 160], [204, 150]])}
</g>`;
}

function salad({ id }: Ctx) {
  const leaf = (x: number, y: number, r: number, c: string, s = 1) =>
    `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})"><path d="M-30 0 C-20 -22 20 -22 30 0 C20 18 -20 18 -30 0 Z" fill="${c}"/><path d="M-26 0 Q0 -4 26 0" stroke="#fff" stroke-opacity="0.45" stroke-width="2" fill="none"/></g>`;
  const chicken = (x: number, y: number, r: number) =>
    `<g transform="translate(${x} ${y}) rotate(${r})"><rect x="-22" y="-8" width="44" height="16" rx="7" fill="#E4B47A" stroke="#A9773F" stroke-width="2"/><g stroke="#7A4A1E" stroke-width="2.5" stroke-linecap="round" opacity="0.7"><path d="M-12 -6 l-5 12"/><path d="M0 -6 l-5 12"/><path d="M12 -6 l-5 12"/></g></g>`;
  return `<defs><linearGradient id="bowl-${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#E9E2D3"/><stop offset="0.35" stop-color="#fff"/><stop offset="1" stop-color="#DDD3C0"/></linearGradient></defs>
${shadow(120, 296, 96)}
<g class="pb-float">
<ellipse cx="120" cy="196" rx="92" ry="22" fill="#EFE7D6"/>
<g class="pb-sway">
${leaf(72, 186, -24, "#4F8F3A")}${leaf(160, 182, 22, "#4F8F3A")}${leaf(116, 166, -4, "#6DB04B", 1.1)}${leaf(88, 164, -40, "#8CC461", 0.85)}${leaf(150, 160, 36, "#8CC461", 0.85)}${leaf(120, 190, 6, "#3E7A2E")}
</g>
${chicken(98, 176, -14)}${chicken(140, 172, 12)}${chicken(118, 156, 4)}
<g><circle cx="78" cy="196" r="11" fill="#D63B2E"/><path d="M71 192 a7 7 0 0 1 10 -4" stroke="#fff" stroke-width="2.5" fill="none" opacity="0.6"/>
<circle cx="164" cy="194" r="10" fill="#D63B2E"/><path d="M158 190 a6 6 0 0 1 9 -3" stroke="#fff" stroke-width="2.5" fill="none" opacity="0.6"/>
<circle cx="136" cy="198" r="10" fill="#7CB65A" stroke="#3E7A2E" stroke-width="2.5"/><circle cx="136" cy="198" r="5" fill="#DDEFC2"/>
<circle cx="102" cy="200" r="9" fill="#7CB65A" stroke="#3E7A2E" stroke-width="2.5"/><circle cx="102" cy="200" r="4.5" fill="#DDEFC2"/></g>
<g fill="#F5C842">${[[124, 186], [130, 182], [112, 192], [150, 180], [90, 186]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2"/>`).join("")}</g>
<path d="M28 198 Q120 226 212 198 Q206 284 120 288 Q34 284 28 198 Z" fill="url(#bowl-${id})" stroke="#E2D9C6" stroke-width="2"/>
<path d="M40 226 Q120 250 200 226" stroke="#7DAA5A" stroke-width="5" fill="none" opacity="0.55"/>
${badge(120, 258, 13, PEACH, OLIVE)}
${sparkles([[52, 146], [192, 138]])}
</g>`;
}

function waffle({ id }: Ctx) {
  // Square waffles seen from above at an angle, with deep pockets.
  const waf = (cx: number, cy: number, rot: number) => {
    const cells = [-1.5, -0.5, 0.5, 1.5]
      .flatMap((i) => [-1.5, -0.5, 0.5, 1.5].map((j) => `<rect x="${i * 26 - 10}" y="${j * 26 - 10}" width="20" height="20" rx="3" fill="#B8742C"/><rect x="${i * 26 - 10}" y="${j * 26 - 10}" width="20" height="6" rx="3" fill="#8E5418" opacity="0.6"/>`))
      .join("");
    const top = (dy: number, fill: string) =>
      `<g transform="translate(${cx} ${cy + dy}) scale(1 0.56) rotate(${rot})"><rect x="-56" y="-56" width="112" height="112" rx="14" fill="${fill}"/></g>`;
    return `${top(16, "#9A5A1C")}${top(8, "#B8742C")}
<g transform="translate(${cx} ${cy}) scale(1 0.56) rotate(${rot})"><rect x="-56" y="-56" width="112" height="112" rx="14" fill="url(#waf-${id})" stroke="#A9661F" stroke-width="3"/>${cells}</g>`;
  };
  return `<defs><radialGradient id="waf-${id}" cx="0.4" cy="0.35" r="0.8"><stop offset="0" stop-color="#F7CF7E"/><stop offset="1" stop-color="#DB9A45"/></radialGradient></defs>
${shadow(120, 296, 100)}
<g class="pb-float">
${steam([100, 140], 112)}
<ellipse cx="120" cy="262" rx="104" ry="30" fill="#D9D0BE"/><ellipse cx="120" cy="256" rx="104" ry="30" fill="#fff"/>
${waf(120, 222, 45)}${waf(118, 182, 38)}
<g transform="translate(118 166)"><path d="M-16 -6 L0 -14 L16 -6 L0 2 Z" fill="#FFF3B8"/><path d="M-16 -6 L0 2 L0 12 L-16 4 Z" fill="#F2DC85"/><path d="M16 -6 L0 2 L0 12 L16 4 Z" fill="#E6C863"/></g>
<path d="M78 180 C92 166 104 194 118 178 C132 164 146 192 160 176" fill="none" stroke="#7A3A0E" stroke-width="7" stroke-linecap="round" opacity="0.85"/>
<path class="pb-drip" d="M78 182 C76 196 80 208 76 222" fill="none" stroke="#7A3A0E" stroke-width="7" stroke-linecap="round" opacity="0.85"/>
<path class="pb-drip" style="animation-delay:0.8s" d="M160 178 C162 192 158 200 162 214" fill="none" stroke="#7A3A0E" stroke-width="6" stroke-linecap="round" opacity="0.85"/>
<g><circle cx="196" cy="236" r="8" fill="#B5354A"/><circle cx="208" cy="246" r="7" fill="#3A3A7A"/><circle cx="44" cy="244" r="7" fill="#B5354A"/></g>
</g>`;
}

function cake({ id }: Ctx) {
  // A tall chocolate layer slice with ganache, cream and a strawberry.
  const band = (y: number, h: number, c: string) => `<rect x="36" y="${y}" width="168" height="${h}" fill="${c}"/>`;
  return `<defs><clipPath id="ck-${id}"><path d="M36 186 L204 186 L204 262 L36 262 Z"/></clipPath>
<linearGradient id="gan-${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6B3A26"/><stop offset="1" stop-color="#3A1E14"/></linearGradient></defs>
${shadow(120, 296, 100)}
<g class="pb-float">
<ellipse cx="124" cy="274" rx="106" ry="20" fill="#D9D0BE"/><ellipse cx="124" cy="268" rx="106" ry="20" fill="#fff"/>
<path d="M204 186 L228 160 L228 238 L204 262 Z" fill="#4A2618"/>
<g clip-path="url(#ck-${id})">
${band(186, 80, "#5A3020")}${band(206, 8, "#F3E3C8")}${band(232, 8, "#F3E3C8")}
<g fill="#3F2015" opacity="0.5">${[[60, 196], [100, 222], [150, 198], [180, 250], [80, 250], [130, 246], [170, 220]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.5"/>`).join("")}</g>
</g>
<path d="M36 186 L204 186 L228 160 Z" fill="url(#gan-${id})"/>
<path class="pb-drip" d="M40 186 L204 186 L204 196 C196 196 196 212 188 212 C180 212 182 194 170 196 C160 198 162 220 150 220 C140 220 142 196 128 196 C116 196 118 208 106 208 C96 208 98 194 86 194 C76 194 78 214 66 214 C56 214 58 194 40 194 Z" fill="#3A1E14"/>
<path d="M60 190 L180 190" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.25"/>
<g class="pb-bob">
<path d="M170 168 C150 166 150 146 164 144 C160 128 184 124 186 140 C200 138 204 160 186 166 Z" fill="${CREAM}" stroke="#E8DCC4" stroke-width="2"/>
<path d="M176 132 C162 128 158 112 170 104 C178 100 196 102 198 116 C200 130 188 136 176 132 Z" fill="#D2364C"/>
<path d="M170 104 C172 96 180 94 184 98 C188 92 196 96 192 102 Z" fill="#3E8E3E"/>
<g fill="#FCE3A1">${[[176, 112], [186, 116], [180, 124], [190, 126]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1.4" ry="2"/>`).join("")}</g>
</g>
${sparkles([[54, 140], [214, 104]])}
</g>`;
}

function bread({ id }: Ctx) {
  // Zebra bread: a loaf with a sliced piece showing the marbled swirl.
  const slice = "M70 284 L70 200 C70 158 170 158 170 200 L170 284 Z";
  const rings = [0.86, 0.72, 0.58, 0.44, 0.3, 0.16]
    .map((k, i) => `<path d="${slice}" transform="translate(120 240) scale(${k} ${k * 0.92}) rotate(${i % 2 ? 6 : -5}) translate(-120 -240)" fill="${i % 2 ? "#F3DDB0" : "#6B3F25"}"/>`)
    .join("");
  return `<defs><linearGradient id="crust-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C98848"/><stop offset="1" stop-color="#8A4E22"/></linearGradient>
<clipPath id="sl-${id}"><path d="${slice}"/></clipPath></defs>
${shadow(120, 298, 100)}
<g class="pb-float">
<path d="M84 248 L84 160 C84 110 222 110 222 160 L222 248 Q222 262 208 262 L98 262 Q84 262 84 248 Z" fill="url(#crust-${id})"/>
<path d="M100 140 C130 122 180 122 206 140" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity="0.25" fill="none"/>
<g stroke="#7A4220" stroke-width="3" opacity="0.5" fill="none"><path d="M120 136 q14 10 0 22"/><path d="M160 130 q14 10 0 22"/><path d="M196 138 q12 10 0 20"/></g>
<g transform="rotate(-6 120 240)">
<path d="${slice}" fill="#F3DDB0"/>
<g clip-path="url(#sl-${id})">${rings}</g>
<path d="${slice}" fill="none" stroke="#9A5A2A" stroke-width="8" stroke-linejoin="round"/>
</g>
${flakes([[60, 170, "#C98848"], [186, 100, "#6B3F25"], [52, 220, "#F3DDB0"]])}
</g>`;
}

function croissant({ id }: Ctx) {
  // A wide golden crescent: puffy rolls bulging along the top, thick in the
  // middle and tapering to thin tips that droop down, with buttery shine.
  const C = { x: 120, y: 236 };
  const O = { rx: 104, ry: 104 };
  const I = { rx: 82, ry: 20 };
  const pt = (e: { rx: number; ry: number }, deg: number) => {
    const t = (deg * Math.PI) / 180;
    return `${(C.x + e.rx * Math.sin(t)).toFixed(1)} ${(C.y - e.ry * Math.cos(t)).toFixed(1)}`;
  };
  const big = { rx: O.rx + 14, ry: O.ry + 14 };
  const marks = [-84, -62, -38, -13, 13, 38, 62, 84];
  let edge = "";
  for (let i = 0; i < marks.length - 1; i++) {
    edge += ` Q${pt(big, (marks[i] + marks[i + 1]) / 2)} ${pt(O, marks[i + 1])}`;
  }
  const body = `M${C.x - O.rx + 12} ${C.y + 26} Q${C.x - O.rx - 6} ${C.y + 10} ${pt(O, -84)}${edge} Q${C.x + O.rx + 6} ${C.y + 10} ${C.x + O.rx - 12} ${C.y + 26} Q${C.x + I.rx + 2} ${C.y + 14} ${pt(I, 84)} A${I.rx} ${I.ry} 0 0 0 ${pt(I, -84)} Q${C.x - I.rx - 2} ${C.y + 14} ${C.x - O.rx + 12} ${C.y + 26} Z`;
  const grooves = marks
    .slice(1, -1)
    .map((d) => {
      const [x1, y1] = pt(O, d).split(" ").map(Number);
      const [x2, y2] = pt(I, d * 1.08).split(" ").map(Number);
      const bend = Math.sign(d) * 16;
      return `<path d="M${x1} ${y1} Q${((x1 + x2) / 2 + bend).toFixed(1)} ${((y1 + y2) / 2).toFixed(1)} ${x2} ${y2}"/>`;
    })
    .join("");
  const shine = [-73, -50, -25, 0, 25, 50, 73]
    .map((d) => {
      const e = { rx: O.rx - 6, ry: O.ry - 8 };
      const w = Math.abs(d) > 60 ? 5 : 8;
      return `<path d="M${pt(e, d - w)} Q${pt({ rx: e.rx + 8, ry: e.ry + 8 }, d)} ${pt(e, d + w)}" stroke-width="${Math.abs(d) > 60 ? 3.5 : 5.5}"/>`;
    })
    .join("");
  return `<defs><radialGradient id="cr-${id}" cx="0.5" cy="0.25" r="0.75"><stop offset="0" stop-color="#FBD892"/><stop offset="0.45" stop-color="#EAA24C"/><stop offset="0.8" stop-color="#C47024"/><stop offset="1" stop-color="#97501A"/></radialGradient></defs>
${shadow(120, 290, 104)}
<g class="pb-float">
<path d="${body}" fill="#8E4A16" transform="translate(0 7)"/>
<path d="${body}" fill="url(#cr-${id})" stroke="#A9601F" stroke-width="2" stroke-linejoin="round"/>
<g fill="none" stroke="#8A4612" stroke-width="3.5" stroke-linecap="round" opacity="0.5">${grooves}</g>
<g fill="none" stroke="#FFF2C8" stroke-linecap="round" opacity="0.85">${shine}</g>
${flakes([[60, 132, "#E9A84F"], [176, 120, "#FCDC96"], [118, 100, "#BE6E22"], [206, 170, "#E9A84F"]])}
${sparkles([[40, 112], [206, 100]])}
</g>`;
}

function pizza({ id }: Ctx) {
  return `<defs><linearGradient id="chz-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD873"/><stop offset="1" stop-color="#F0B33E"/></linearGradient>
<linearGradient id="crs-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E6A458"/><stop offset="1" stop-color="#A9621F"/></linearGradient>
<radialGradient id="pep-${id}" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="#E0573E"/><stop offset="1" stop-color="#9E2A1C"/></radialGradient></defs>
${shadow(120, 298, 80)}
<g class="pb-float">
<path d="M124 284 L40 112 Q120 84 202 112 Z" fill="#C44A2C"/>
<path d="M120 276 L44 112 Q120 86 198 112 Z" fill="url(#chz-${id})" stroke="#E0A030" stroke-width="2" stroke-linejoin="round"/>
<g fill="#E09A2E" opacity="0.6">${[[90, 150], [140, 132], [118, 214], [150, 168], [104, 120]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="7" ry="4"/>`).join("")}</g>
${[[94, 144], [146, 140], [122, 186], [108, 228], [156, 178], [74, 120]]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="14" fill="url(#pep-${id})"/><g fill="#7A1E14" opacity="0.6"><circle cx="${x + 4}" cy="${y + 3}" r="1.8"/><circle cx="${x - 4}" cy="${y + 5}" r="1.5"/><circle cx="${x + 1}" cy="${y - 5}" r="1.5"/></g><ellipse cx="${x - 5}" cy="${y - 5}" rx="4" ry="2.4" fill="#fff" opacity="0.45"/>`)
    .join("")}
<g fill="#2F7A2F">${[[126, 160, 20], [100, 196, -30], [168, 126, 40]].map(([x, y, r]) => `<path transform="rotate(${r} ${x} ${y})" d="M${x - 10} ${y} C${x - 6} ${y - 8} ${x + 6} ${y - 8} ${x + 10} ${y} C${x + 6} ${y + 7} ${x - 6} ${y + 7} ${x - 10} ${y} Z"/>`).join("")}</g>
<path d="M30 108 Q120 70 212 108 L206 126 Q120 94 36 126 Z" fill="url(#crs-${id})"/>
<g fill="#F7D9A6" opacity="0.8">${[[70, 104], [110, 92], [150, 94], [186, 104]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="5" ry="2"/>`).join("")}</g>
<path class="pb-drip" d="M108 250 C108 266 112 274 110 286 M128 262 C128 274 132 280 130 292" stroke="#FFD873" stroke-width="6" fill="none" stroke-linecap="round"/>
</g>`;
}

function pie({ id }: Ctx) {
  // Nigerian meat pie: golden glazed half moon, fork crimped edge.
  const cx = 120;
  const cy = 236;
  const r = 96;
  const scallops = Array.from({ length: 17 }, (_, i) => {
    const t = Math.PI + (i / 16) * Math.PI;
    return `<circle cx="${(cx + Math.cos(t) * r).toFixed(1)}" cy="${(cy + Math.sin(t) * r).toFixed(1)}" r="10" fill="url(#pie-${id})" stroke="#A9621F" stroke-width="2"/>`;
  }).join("");
  const forks = Array.from({ length: 22 }, (_, i) => {
    const t = Math.PI + ((i + 0.5) / 22) * Math.PI;
    const c = Math.cos(t);
    const s = Math.sin(t);
    return `<path d="M${(cx + c * (r - 16)).toFixed(1)} ${(cy + s * (r - 16)).toFixed(1)} L${(cx + c * (r - 4)).toFixed(1)} ${(cy + s * (r - 4)).toFixed(1)}"/>`;
  }).join("");
  return `<defs><radialGradient id="pie-${id}" cx="0.45" cy="0.25" r="0.85"><stop offset="0" stop-color="#FBD38A"/><stop offset="0.5" stop-color="#E5A24E"/><stop offset="1" stop-color="#B66A22"/></radialGradient></defs>
${shadow(120, 286, 104)}
<g class="pb-float">
${steam([100, 140], 116)}
<path d="M${cx - r - 8} ${cy + 4} A${r + 8} ${r + 8} 0 0 1 ${cx + r + 8} ${cy + 4} Q${cx} ${cy + 34} ${cx - r - 8} ${cy + 4} Z" fill="#8E4A16"/>
${scallops}
<path d="M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy} Q${cx} ${cy + 24} ${cx - r} ${cy} Z" fill="url(#pie-${id})" stroke="#A9621F" stroke-width="2.5"/>
<g stroke="#9A5418" stroke-width="2.5" stroke-linecap="round" opacity="0.65">${forks}</g>
<path d="M58 206 A70 70 0 0 1 150 156" fill="none" stroke="#FFF4D0" stroke-width="8" stroke-linecap="round" opacity="0.45"/>
<g fill="#8E4A16">${[[104, 196, -20], [124, 190, 0], [144, 196, 20]].map(([x, y, rot]) => `<rect x="${x - 2.5}" y="${y - 9}" width="5" height="18" rx="2.5" transform="rotate(${rot} ${x} ${y})"/>`).join("")}</g>
<g fill="#B66A22" opacity="0.5">${[[90, 220], [160, 214], [122, 228], [70, 230], [176, 230]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6"/>`).join("")}</g>
${sparkles([[40, 140], [204, 132]])}
</g>`;
}

function wrap({ id }: Ctx) {
  // Shawarma: a toasted flatbread roll packed with chicken and veg, half in paper.
  return `<defs><linearGradient id="fb-${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#E8C78F"/><stop offset="0.5" stop-color="#F7E2B4"/><stop offset="1" stop-color="#D9AE6C"/></linearGradient>
<linearGradient id="pp-${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#E9E2D3"/><stop offset="0.45" stop-color="#fff"/><stop offset="1" stop-color="#DCD3C1"/></linearGradient></defs>
${shadow(120, 300, 64)}
<g class="pb-float"><g transform="rotate(-10 120 190)">
${steam([104, 138], 84)}
<g class="pb-sway">
<path d="M70 108 C74 82 92 92 100 80 C108 94 124 74 134 90 C144 78 164 86 168 108 Z" fill="#6DB04B"/>
<path d="M78 106 C84 92 96 98 104 90 C110 100 122 92 128 100 Z" fill="#B14A8C" opacity="0.85"/>
${[[92, 100, "#B9783A"], [114, 94, "#A9682A"], [138, 98, "#C68A4A"], [154, 104, "#B9783A"]].map(([x, y, c]) => `<rect x="${Number(x) - 9}" y="${Number(y) - 7}" width="18" height="14" rx="5" fill="${c}"/>`).join("")}
<circle cx="102" cy="106" r="7" fill="#D63B2E"/><circle cx="146" cy="106" r="6" fill="#D63B2E"/>
<path d="M80 98 C90 90 96 104 106 96 C116 88 122 102 132 94 C142 86 150 100 160 94" stroke="#FFF8E8" stroke-width="4" fill="none" stroke-linecap="round"/>
</g>
<path d="M64 110 Q120 92 176 110 L152 286 Q120 300 88 286 Z" fill="url(#fb-${id})" stroke="#C99A5B" stroke-width="3"/>
<g stroke="#A9682A" stroke-width="5" stroke-linecap="round" opacity="0.5"><path d="M80 130 L100 124"/><path d="M118 126 L142 122"/><path d="M84 152 L108 148"/><path d="M128 150 L156 144"/></g>
<path d="M74 168 Q120 150 166 168 L152 286 Q120 300 88 286 Z" fill="url(#pp-${id})"/>
<path d="M74 168 L120 214 L166 168" fill="none" stroke="#D8CFBC" stroke-width="2"/>
${badge(120, 240, 18, PEACH, OLIVE)}
</g></g>`;
}

function sandwich({ id }: Ctx) {
  // A club sandwich half, cut side facing us, with every layer showing.
  const tri = "M42 262 Q34 262 38 254 L114 118 Q120 108 126 118 L202 254 Q206 262 198 262 Z";
  return `<defs><clipPath id="sw-${id}"><path d="${tri}"/></clipPath></defs>
${shadow(120, 292, 98)}
<g class="pb-float">
<path d="M58 270 Q52 270 56 262 L130 128 Q136 118 142 128 L214 262 Q218 270 210 270 Z" fill="#C98A3E"/>
<g clip-path="url(#sw-${id})">
<rect x="20" y="100" width="200" height="180" fill="#F7EBCF"/>
<path d="M20 186 C36 176 48 196 64 186 C80 176 92 196 108 186 C124 176 136 196 152 186 C168 176 180 196 196 186 C208 178 216 190 220 186 L220 200 L20 200 Z" fill="#5FA845"/>
<rect x="20" y="198" width="200" height="11" fill="#D9412E"/>
<rect x="20" y="209" width="200" height="8" fill="#F2C14E"/>
<rect x="20" y="217" width="200" height="11" fill="#E79A9A"/>
<path d="M20 228 C40 224 60 232 80 228 C100 224 120 232 140 228 C160 224 180 232 220 228 L220 234 L20 234 Z" fill="#F7D774"/>
<g fill="#E8D5AE" opacity="0.8">${[[100, 150], [130, 170], [116, 132], [80, 250], [150, 250], [120, 246]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2"/>`).join("")}</g>
</g>
<path d="${tri}" fill="none" stroke="#C98A3E" stroke-width="9" stroke-linejoin="round"/>
<path class="pb-sway" d="M30 196 C26 188 38 184 40 192 Z M210 196 C214 188 202 184 200 192 Z" fill="#5FA845"/>
<path class="pb-drip" d="M54 212 L48 226 L62 214 Z M186 212 L194 228 L178 214 Z" fill="#F2C14E"/>
<rect x="117" y="70" width="5" height="70" rx="2.5" fill="#D9B07A"/>
<circle cx="119.5" cy="72" r="11" fill="#5E7D2A"/><circle cx="119.5" cy="72" r="4" fill="#D63B2E"/><ellipse cx="115" cy="67" rx="3" ry="2" fill="#fff" opacity="0.5"/>
${sparkles([[44, 120], [198, 116]])}
</g>`;
}

function combo(ctx: Ctx) {
  return `${shadow(120, 300, 104)}
<g transform="translate(-12 46) scale(0.62)">${iced(ctx)}</g>
<g transform="translate(92 120) scale(0.62)">${waffle({ ...ctx, id: `${ctx.id}c` })}</g>
${sparkles([[204, 70], [36, 40]])}`;
}

// ---------------------------------------------------------------------------
// Merch
// ---------------------------------------------------------------------------
function tee({ a }: Ctx) {
  const dark = isDark(a);
  const stroke = dark ? "#3A4034" : "#E2DBCD";
  return `${shadow(120, 296, 86)}
<g class="pb-sway">
<path d="M120 38 L120 54" stroke="#9AA08F" stroke-width="4"/><path d="M96 62 Q120 44 144 62" fill="none" stroke="#9AA08F" stroke-width="4"/>
<path d="M78 66 L40 86 L18 138 L56 154 L66 132 L66 280 L174 280 L174 132 L184 154 L222 138 L200 86 L162 66 Q120 92 78 66 Z" fill="${a}" stroke="${stroke}" stroke-width="4" stroke-linejoin="round"/>
<path d="M98 70 Q120 88 142 70" fill="none" stroke="${stroke}" stroke-width="4"/>
${badge(146, 124, 14, dark ? PEACH : OLIVE, dark ? a : a)}
</g>`;
}

function tote({ a }: Ctx) {
  return `${shadow(120, 298, 90)}
<g class="pb-sway">
<path d="M84 110 C84 40 156 40 156 110" fill="none" stroke="${a}" stroke-width="10" stroke-linecap="round"/>
<path d="M48 108 L192 108 L204 288 L36 288 Z" fill="${a}" stroke="#3A4034" stroke-width="3" stroke-linejoin="round"/>
${badge(120, 176, 30, PEACH, a)}
<g fill="${PEACH}" opacity="0.9">${[56, 92, 128, 164].map((x, i) => `<path class="pb-bob" style="animation-delay:${i * 0.3}s" d="M${x} 284 C${x + 4} 252 ${x + 20} 240 ${x + 30} 236 C${x + 22} 252 ${x + 14} 266 ${x + 12} 284 Z"/>`).join("")}</g>
</g>`;
}

function cap({ a }: Ctx) {
  return `${shadow(120, 262, 96)}
<g class="pb-float">
<path d="M150 220 Q214 214 230 236 Q196 250 140 240 Z" fill="${mix(a, "#000", 0.1)}" stroke="#3A4034" stroke-width="3"/>
<path d="M28 226 C24 126 90 96 124 98 C170 100 196 140 196 226 Z" fill="${a}" stroke="#3A4034" stroke-width="3"/>
<path d="M112 100 C102 140 100 190 104 226" stroke="#3A4034" stroke-width="3" fill="none"/>
<circle cx="122" cy="98" r="7" fill="${a}" stroke="#3A4034" stroke-width="3"/>
${badge(66, 176, 22, PEACH, a)}
${sparkles([[200, 96]])}
</g>`;
}

function isDark(hex: string) {
  const h = hex.slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b < 110;
}

const DRAW: Record<ArtStyle, (c: Ctx) => string> = {
  iced: (c) => iced(c),
  frappe: (c) => iced(c, true),
  juice,
  hot,
  plate,
  salad,
  waffle,
  cake,
  bread,
  croissant,
  pizza,
  pie,
  wrap,
  sandwich,
  combo,
  tee,
  tote,
  cap,
};

export function isArtStyle(v: unknown): v is ArtStyle {
  return typeof v === "string" && (ART_STYLES as readonly string[]).includes(v);
}

export function menuArtSvg({ art, accent, idSuffix = "a" }: { art?: string | null; accent: string; idSuffix?: string }): string {
  const style: ArtStyle = isArtStyle(art) ? art : "iced";
  const a = HEX.test(accent) ? accent : "#A9B89A";
  const id = idSuffix.replace(/[^a-z0-9]/gi, "").slice(0, 16) || "a";
  const ctx: Ctx = {
    a,
    id,
    deep: mix(a, INK, 0.22),
    light: mix(a, CREAM, 0.45),
    pale: mix(a, CREAM, 0.82),
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 320" role="img" aria-hidden="true" class="pb-art">${DRAW[style](ctx)}</svg>`;
}
