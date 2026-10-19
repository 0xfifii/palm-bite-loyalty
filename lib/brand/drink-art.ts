/**
 * Original Palm Bite drink illustration, generated as SVG from a single accent
 * colour. Used whenever a drink has no uploaded photograph, so the menu always
 * looks finished. Pure function: safe on server and client.
 */

const HEX = /^#[0-9a-f]{6}$/i;

function parse(hex: string): [number, number, number] {
  const h = HEX.test(hex) ? hex.slice(1) : "a9b89a";
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
}

export function mix(a: string, b: string, t: number): string {
  const ca = parse(a);
  const cb = parse(b);
  return toHex([0, 1, 2].map((i) => ca[i] + (cb[i] - ca[i]) * t) as [number, number, number]);
}

export type DrinkArtOptions = {
  accent: string;
  straw?: string;
  idSuffix?: string;
};

export function drinkSvg({ accent, straw = "#34432A", idSuffix = "a" }: DrinkArtOptions): string {
  const safeAccent = HEX.test(accent) ? accent : "#A9B89A";
  const safeStraw = HEX.test(straw) ? straw : "#34432A";
  const id = idSuffix.replace(/[^a-z0-9]/gi, "").slice(0, 16) || "a";
  const top = safeAccent;
  const deep = mix(safeAccent, "#1D2119", 0.18);
  const milk = mix(safeAccent, "#FBF7EE", 0.82);
  const swirl = mix(safeAccent, "#FBF7EE", 0.45);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 320" role="img" aria-hidden="true">
<defs>
<clipPath id="cup-${id}"><path d="M52 92 L188 92 L172 286 Q171 298 159 298 L81 298 Q69 298 68 286 Z"/></clipPath>
<linearGradient id="liq-${id}" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="${deep}"/><stop offset="0.5" stop-color="${top}"/><stop offset="1" stop-color="${top}"/>
</linearGradient>
<linearGradient id="glass-${id}" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/><stop offset="0.18" stop-color="#ffffff" stop-opacity="0.12"/>
<stop offset="0.8" stop-color="#ffffff" stop-opacity="0.05"/><stop offset="1" stop-color="#ffffff" stop-opacity="0.35"/>
</linearGradient>
</defs>
<ellipse cx="120" cy="304" rx="70" ry="8" fill="#1D2119" opacity="0.12"/>
<rect x="138" y="8" width="14" height="150" rx="7" transform="rotate(14 145 83)" fill="${safeStraw}"/>
<g clip-path="url(#cup-${id})">
<rect x="40" y="88" width="160" height="220" fill="${milk}"/>
<path d="M40 86 L200 86 L200 196 C176 214 160 182 136 200 C112 218 96 188 72 206 C58 216 48 206 40 210 Z" fill="url(#liq-${id})"/>
<path d="M60 214 C84 200 98 226 122 212 C146 198 160 222 186 208" stroke="${swirl}" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.7"/>
<path d="M66 240 C92 228 110 250 134 238 C156 228 170 246 184 238" stroke="${swirl}" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.45"/>
<g fill="#ffffff" fill-opacity="0.42" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2">
<rect x="62" y="96" width="38" height="36" rx="9" transform="rotate(-12 81 114)"/>
<rect x="104" y="92" width="40" height="38" rx="9" transform="rotate(8 124 111)"/>
<rect x="146" y="100" width="34" height="34" rx="8" transform="rotate(-6 163 117)"/>
<rect x="84" y="134" width="34" height="32" rx="8" transform="rotate(16 101 150)"/>
<rect x="128" y="138" width="32" height="30" rx="8" transform="rotate(-18 144 153)"/>
</g>
</g>
<path d="M52 92 L188 92 L172 286 Q171 298 159 298 L81 298 Q69 298 68 286 Z" fill="url(#glass-${id})" stroke="#ffffff" stroke-opacity="0.9" stroke-width="2.5"/>
<path d="M44 82 Q44 74 52 74 L188 74 Q196 74 196 82 L196 86 Q196 94 188 94 L52 94 Q44 94 44 86 Z" fill="#ffffff" fill-opacity="0.5" stroke="#ffffff" stroke-width="2"/>
<rect x="62" y="104" width="7" height="170" rx="3.5" fill="#ffffff" opacity="0.45"/>
<g fill="#ffffff" opacity="0.75">
<circle cx="164" cy="132" r="2.4"/><circle cx="158" cy="176" r="1.8"/><circle cx="168" cy="210" r="2.6"/>
<circle cx="78" cy="226" r="1.8"/><circle cx="84" cy="258" r="2.2"/><circle cx="160" cy="250" r="1.6"/>
</g>
</svg>`;
}

export function drinkDataUri(options: DrinkArtOptions): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(drinkSvg(options))}`;
}
