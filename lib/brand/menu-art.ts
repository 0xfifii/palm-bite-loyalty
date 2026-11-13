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

const shadow = (cx = 120, cy = 304, rx = 78) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="8" fill="${INK}" opacity="0.12"/>`;

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
<rect class="pb-sway" x="138" y="${topping ? 0 : 8}" width="14" height="150" rx="7" transform="rotate(14 145 83)" fill="${OLIVE}"/>
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
  return `<defs><clipPath id="jg-${id}"><rect x="66" y="96" width="108" height="196" rx="14"/></clipPath>
<linearGradient id="jl-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${a}"/></linearGradient></defs>
${shadow(120, 304, 62)}
<g class="pb-float">
<rect class="pb-sway" x="128" y="20" width="12" height="150" rx="6" transform="rotate(10 134 95)" fill="${OLIVE}"/>
<g clip-path="url(#jg-${id})">
<rect x="60" y="96" width="120" height="200" fill="url(#jl-${id})"/>
<path d="M60 118 C84 108 100 128 124 116 C148 104 162 122 182 114 L182 96 L60 96 Z" fill="#fff" opacity="0.35"/>
${bubbles([[90, 270, 3], [110, 250, 2.4], [140, 276, 2.8], [150, 230, 2], [96, 210, 2.2], [130, 190, 2.6]])}
</g>
<rect x="66" y="96" width="108" height="196" rx="14" fill="none" stroke="#fff" stroke-width="3"/>
<rect x="78" y="110" width="7" height="160" rx="3.5" fill="#fff" opacity="0.5"/>
<g class="pb-bob" transform="translate(170 104)">
<path d="M-34 0 A34 34 0 0 1 34 0 Z" fill="${a}" stroke="${deep}" stroke-width="4"/>
<path d="M-26 0 A26 26 0 0 1 26 0 Z" fill="${light}"/>
<g stroke="${deep}" stroke-width="2.5" opacity="0.6"><path d="M0 0 L0 -24"/><path d="M0 0 L-18 -16"/><path d="M0 0 L18 -16"/></g>
</g>
</g>`;
}

function hot({ a, deep, light }: Ctx) {
  return `${shadow(120, 300, 92)}
<g class="pb-float">
${steam([96, 120, 144], 108)}
<ellipse cx="120" cy="286" rx="92" ry="18" fill="#fff" stroke="${CREAM}" stroke-width="3"/>
<ellipse cx="120" cy="282" rx="64" ry="10" fill="${CREAM}"/>
<path d="M176 150 C214 150 214 222 172 222" fill="none" stroke="#fff" stroke-width="16" stroke-linecap="round"/>
<path d="M58 132 L182 132 L172 254 Q170 278 146 278 L94 278 Q70 278 68 254 Z" fill="#fff"/>
<path d="M58 132 L182 132 L180 150 L60 150 Z" fill="${CREAM}"/>
<ellipse cx="120" cy="134" rx="62" ry="15" fill="${deep}"/>
<ellipse cx="120" cy="134" rx="54" ry="11" fill="${a}"/>
<path class="pb-twinkle" d="M120 144 C102 132 108 120 120 128 C132 120 138 132 120 144 Z" fill="${light}"/>
<rect x="80" y="160" width="8" height="90" rx="4" fill="${CREAM}"/>
${badge(140, 210, 16, PEACH, OLIVE)}
</g>`;
}

// ---------------------------------------------------------------------------
// Food
// ---------------------------------------------------------------------------
const plateBase = () =>
  `<ellipse cx="120" cy="230" rx="104" ry="44" fill="#fff"/><ellipse cx="120" cy="226" rx="104" ry="44" fill="#fff" stroke="${CREAM}" stroke-width="4"/><ellipse cx="120" cy="226" rx="74" ry="28" fill="${CREAM}"/>`;

function plate({ a, deep }: Ctx) {
  const slices: [number, number, number][] = [[78, 214, -20], [104, 202, 10], [134, 206, -8], [160, 214, 22], [92, 230, 30], [124, 232, -14], [152, 234, 8]];
  return `${shadow(120, 276, 100)}
<g class="pb-float">
${steam([96, 144], 160)}
${plateBase()}
<g class="pb-bob">${slices.map(([x, y, r]) => `<g transform="rotate(${r} ${x} ${y})"><ellipse cx="${x}" cy="${y}" rx="20" ry="11" fill="${deep}"/><ellipse cx="${x}" cy="${y - 2}" rx="17" ry="8" fill="${a}"/></g>`).join("")}</g>
<g><path d="M96 208 l10 -6 l4 8 z" fill="#D63B2E"/><path d="M140 222 l12 -4 l0 9 z" fill="#3E8E3E"/><path d="M118 216 l9 4 l-6 6 z" fill="#D63B2E"/><path d="M74 226 l9 -2 l-2 8 z" fill="#3E8E3E"/><circle cx="160" cy="200" r="4" fill="#F4E1B5"/><circle cx="84" cy="200" r="3.5" fill="#F4E1B5"/></g>
</g>`;
}

function salad({ a }: Ctx) {
  return `${shadow(120, 286, 96)}
<g class="pb-float">
<g class="pb-sway">
${[[70, 190, -30], [96, 176, -10], [124, 172, 8], [152, 180, 24], [174, 196, 40], [84, 206, -20], [160, 208, 30]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="30" ry="18" transform="rotate(${r} ${x} ${y})" fill="${a}" stroke="${mix(a, INK, 0.25)}" stroke-width="3"/>`).join("")}
</g>
<g fill="#D9B07A" stroke="#A9773F" stroke-width="2.5">${[[92, 196, -12], [122, 190, 6], [150, 198, 18]].map(([x, y, r]) => `<rect x="${x - 18}" y="${y - 7}" width="36" height="14" rx="7" transform="rotate(${r} ${x} ${y})"/>`).join("")}</g>
<circle cx="108" cy="212" r="9" fill="#D63B2E"/><circle cx="140" cy="214" r="8" fill="#D63B2E"/>
<path d="M28 206 Q120 222 212 206 Q206 284 120 286 Q34 284 28 206 Z" fill="#fff" stroke="${CREAM}" stroke-width="4"/>
<path d="M44 226 Q120 240 196 226" stroke="${a}" stroke-width="5" fill="none" opacity="0.5"/>
${sparkles([[56, 158], [190, 150]])}
</g>`;
}

function waffle({ a, deep, light }: Ctx) {
  const layer = (y: number) => `<rect x="44" y="${y}" width="152" height="40" rx="14" fill="${a}" stroke="${deep}" stroke-width="3"/>
<g stroke="${deep}" stroke-width="3" opacity="0.55">${[74, 104, 134, 164].map((x) => `<path d="M${x} ${y + 4} V${y + 36}"/>`).join("")}<path d="M48 ${y + 20} H192"/></g>`;
  return `${shadow(120, 290, 98)}
<g class="pb-float">
${steam([100, 140], 116)}
<ellipse cx="120" cy="276" rx="100" ry="16" fill="#fff" stroke="${CREAM}" stroke-width="3"/>
${layer(226)}${layer(184)}${layer(142)}
<rect x="100" y="126" width="40" height="22" rx="6" fill="#F6E3A1" stroke="#E2C86E" stroke-width="2"/>
<path class="pb-drip" d="M60 146 C64 168 72 168 74 150 C78 176 88 176 90 150 C96 166 106 166 110 146" fill="none" stroke="${mix(light, "#7A3E12", 0.6)}" stroke-width="7" stroke-linecap="round"/>
</g>`;
}

function cake({ a, light }: Ctx) {
  return `${shadow(120, 288, 96)}
<g class="pb-float">
<ellipse cx="120" cy="272" rx="100" ry="18" fill="#fff" stroke="${CREAM}" stroke-width="3"/>
<path d="M40 254 L200 254 L200 168 L40 196 Z" fill="${a}"/>
<path d="M40 196 L200 168 L200 182 L40 210 Z" fill="${light}" opacity="0.8"/>
<path d="M40 226 L200 210 L200 222 L40 238 Z" fill="${light}" opacity="0.6"/>
<path d="M40 196 L200 168 L180 150 L28 186 Z" fill="${mix(a, "#000", 0.25)}"/>
<path class="pb-drip" d="M60 192 C62 208 70 208 72 190 M120 180 C122 200 132 200 134 178" stroke="${mix(a, "#000", 0.35)}" stroke-width="7" fill="none" stroke-linecap="round"/>
<g class="pb-bob"><path d="M96 152 C82 120 132 108 124 140 C150 128 154 160 128 162 Z" fill="${CREAM}" stroke="#fff" stroke-width="2"/>
<circle cx="140" cy="132" r="10" fill="#C2334D"/><circle cx="152" cy="146" r="8" fill="#C2334D"/><circle cx="134" cy="130" r="2" fill="#fff" opacity="0.7"/></g>
${sparkles([[60, 140], [196, 124]])}
</g>`;
}

function bread({ a, light }: Ctx) {
  return `${shadow(120, 280, 100)}
<g class="pb-float">
<path d="M28 250 L28 170 C28 118 212 118 212 170 L212 250 Q212 266 196 266 L44 266 Q28 266 28 250 Z" fill="#E8C792" stroke="${mix(a, "#000", 0.2)}" stroke-width="4"/>
<path d="M44 160 C80 140 160 140 196 160 C190 200 172 230 120 230 C72 230 52 200 44 160 Z" fill="${a}"/>
<path d="M62 168 C96 152 146 152 178 168 C170 196 150 212 120 212 C90 212 72 196 62 168 Z" fill="${light}"/>
<path d="M82 176 C104 166 136 166 158 176 C150 192 136 198 120 198 C104 198 90 192 82 176 Z" fill="${a}"/>
<path d="M100 182 C112 178 128 178 140 182 C134 188 126 190 120 190 C114 190 106 188 100 182 Z" fill="${light}"/>
${sparkles([[48, 118], [196, 112]])}
</g>`;
}

function croissant({ a, deep, light }: Ctx) {
  // Five lobes along a crescent, biggest in the middle, tapering to curled tips.
  const lobes: [number, number, number, number, number][] = [
    [40, 222, 16, 12, -50],
    [70, 190, 24, 20, -30],
    [120, 176, 34, 28, 0],
    [170, 190, 24, 20, 30],
    [200, 222, 16, 12, 50],
  ];
  return `${shadow(120, 262, 96)}
<g class="pb-float">
${lobes
  .map(([x, y, rx, ry, r]) => `<g transform="rotate(${r} ${x} ${y})"><ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry + 14}" fill="${a}" stroke="${deep}" stroke-width="4"/><path d="M${x - rx * 0.6} ${y - ry * 0.4} Q${x} ${y - ry - 10} ${x + rx * 0.6} ${y - ry * 0.4}" fill="none" stroke="${light}" stroke-width="5" stroke-linecap="round"/></g>`)
  .join("")}
${sparkles([[56, 140], [190, 132], [120, 110]])}
</g>`;
}

function pizza({ a, light }: Ctx) {
  return `${shadow(120, 286, 80)}
<g class="pb-float">
<path d="M120 276 L36 104 Q120 74 204 104 Z" fill="#F2C14E" stroke="#D99A2B" stroke-width="4" stroke-linejoin="round"/>
<path d="M30 100 Q120 64 210 100 L204 118 Q120 88 36 118 Z" fill="#C9813A"/>
${[[96, 140], [146, 140], [120, 190], [104, 232], [150, 182]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="14" fill="${a}"/><circle cx="${x - 4}" cy="${y - 4}" r="4" fill="${light}" opacity="0.7"/>`).join("")}
<path class="pb-drip" d="M84 176 C86 200 94 200 96 180 M150 210 C152 232 160 232 162 214" stroke="#F2C14E" stroke-width="8" fill="none" stroke-linecap="round"/>
<g fill="#3E8E3E"><circle cx="128" cy="160" r="4"/><circle cx="112" cy="206" r="4"/><circle cx="160" cy="124" r="3.5"/></g>
</g>`;
}

function pie({ a, deep, light }: Ctx) {
  const crimps = Array.from({ length: 11 }, (_, i) => {
    const t = Math.PI + (i / 10) * Math.PI;
    const x = 120 + Math.cos(t) * 96;
    const y = 232 + Math.sin(t) * 96;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="11" fill="${a}" stroke="${deep}" stroke-width="3"/>`;
  }).join("");
  return `${shadow(120, 266, 100)}
<g class="pb-float">
${steam([104, 136], 112)}
${crimps}
<path d="M24 232 A96 96 0 0 1 216 232 Z" fill="${a}" stroke="${deep}" stroke-width="4"/>
<path d="M44 222 A76 76 0 0 1 196 222" fill="none" stroke="${light}" stroke-width="6" stroke-linecap="round" opacity="0.7"/>
<g stroke="${deep}" stroke-width="4" stroke-linecap="round"><path d="M100 180 L112 196"/><path d="M128 176 L140 192"/><path d="M114 156 L126 172"/></g>
</g>`;
}

function wrap({ a, deep }: Ctx) {
  return `${shadow(120, 294, 64)}
<g class="pb-float" transform="rotate(-10 120 180)">
${steam([104, 136], 90)}
<path d="M66 110 Q120 86 174 110 L150 282 Q120 296 90 282 Z" fill="#F4E1B5" stroke="#D9B97A" stroke-width="4"/>
<g class="pb-sway"><path d="M70 112 C80 82 100 98 108 84 C118 100 134 80 142 96 C152 86 168 92 170 112 Z" fill="#3E8E3E"/>
<circle cx="100" cy="104" r="9" fill="#D63B2E"/><circle cx="140" cy="102" r="8" fill="${a}"/><circle cx="120" cy="98" r="7" fill="#F2E3B3"/></g>
<path d="M78 170 Q120 154 162 170 L150 282 Q120 296 90 282 Z" fill="#fff"/>
<path d="M78 170 Q120 154 162 170" fill="none" stroke="${deep}" stroke-width="3" opacity="0.4"/>
${badge(120, 226, 20, PEACH, OLIVE)}
</g>`;
}

function sandwich({ a }: Ctx) {
  const tri = (y: number) => `M36 ${y} L204 ${y} L120 ${y - 112} Z`;
  return `${shadow(120, 272, 96)}
<g class="pb-float">
<path d="${tri(262)}" fill="#F4E1B5" stroke="#C99A5B" stroke-width="6" stroke-linejoin="round"/>
<path class="pb-sway" d="M40 238 Q60 226 80 238 T120 238 T160 238 T200 238 L196 250 L44 250 Z" fill="#5FA845"/>
<path d="M50 226 L190 226 L184 236 L56 236 Z" fill="#D63B2E"/>
<path d="M62 212 L178 212 L172 222 L68 222 Z" fill="${a}"/>
<path d="M58 210 L182 210 L120 120 Z" fill="#F4E1B5" stroke="#C99A5B" stroke-width="6" stroke-linejoin="round"/>
<path d="M92 190 L148 190" stroke="#E8C792" stroke-width="4" stroke-linecap="round"/>
${sparkles([[44, 120], [198, 116]])}
</g>`;
}

function combo(ctx: Ctx) {
  return `${shadow(120, 300, 104)}
<g transform="translate(-12 46) scale(0.62)">${iced(ctx)}</g>
<g transform="translate(92 120) scale(0.62)">${plate({ ...ctx, a: "#E8A53A", deep: "#B9761E" })}</g>
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
