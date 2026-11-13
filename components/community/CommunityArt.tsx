/** Animated illustrations for community clubs and events (motion classes from globals.css). */
export function CommunityArt({ icon, day, className = "" }: { icon: "fitness" | "book" | "spark"; day?: string; className?: string }) {
  const label = (day ?? "").replace(/[^0-9]/g, "").slice(0, 2) || "*";
  const svg = {
    fitness: `<svg viewBox="0 0 200 140" class="pb-art" aria-hidden="true">
<ellipse cx="100" cy="128" rx="76" ry="7" fill="#1D2119" opacity="0.15"/>
<g class="pb-float"><rect x="44" y="62" width="112" height="12" rx="6" fill="#EECFBA"/>
<rect x="26" y="40" width="22" height="56" rx="8" fill="#EECFBA"/><rect x="152" y="40" width="22" height="56" rx="8" fill="#EECFBA"/>
<rect x="14" y="50" width="14" height="36" rx="6" fill="#D4A07F"/><rect x="172" y="50" width="14" height="36" rx="6" fill="#D4A07F"/></g>
<g class="pb-bob"><rect x="86" y="84" width="28" height="44" rx="10" fill="#A9B89A"/><rect x="92" y="76" width="16" height="10" rx="3" fill="#DCE3D2"/><rect x="92" y="96" width="16" height="18" rx="4" fill="#fff" opacity="0.5"/></g>
<g fill="#EECFBA"><path class="pb-twinkle" d="M30 18 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z"/><path class="pb-twinkle" style="animation-delay:1s" d="M172 14 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z"/></g></svg>`,
    book: `<svg viewBox="0 0 200 140" class="pb-art" aria-hidden="true">
<ellipse cx="96" cy="128" rx="80" ry="7" fill="#1D2119" opacity="0.15"/>
<g class="pb-float"><path d="M18 50 Q58 34 96 52 L96 122 Q58 104 18 120 Z" fill="#FBF7EE" stroke="#EECFBA" stroke-width="4"/>
<path d="M174 50 Q134 34 96 52 L96 122 Q134 104 174 120 Z" fill="#FBF7EE" stroke="#EECFBA" stroke-width="4"/>
<g stroke="#A9B89A" stroke-width="3" stroke-linecap="round"><path d="M32 66 Q58 58 84 68"/><path d="M32 80 Q58 72 84 82"/><path d="M32 94 Q58 86 84 96"/><path d="M108 68 Q134 58 160 66"/><path d="M108 82 Q134 72 160 80"/></g></g>
<g transform="translate(150 70)"><g fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><path class="pb-steam" d="M14 0 c-5 -7 5 -11 0 -18"/><path class="pb-steam" style="animation-delay:.8s" d="M26 0 c-5 -7 5 -11 0 -18"/></g>
<path d="M2 6 H38 L34 44 Q33 50 27 50 H13 Q7 50 6 44 Z" fill="#EECFBA"/><path d="M38 14 C50 14 50 32 36 32" fill="none" stroke="#EECFBA" stroke-width="5"/></g></svg>`,
    spark: `<svg viewBox="0 0 200 140" class="pb-art" aria-hidden="true">
<g class="pb-float"><rect x="56" y="34" width="88" height="88" rx="16" fill="#FBF7EE"/><rect x="56" y="34" width="88" height="26" rx="12" fill="#EECFBA"/>
<text x="100" y="104" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="40" font-weight="900" fill="#34432A">${label}</text></g>
<g><circle class="pb-bubble" cx="36" cy="110" r="5" fill="#EECFBA"/><circle class="pb-bubble" style="animation-delay:.6s" cx="166" cy="116" r="6" fill="#A9B89A"/>
<rect class="pb-bob" x="20" y="40" width="10" height="10" rx="2" fill="#E39AA6"/><rect class="pb-bob" style="animation-delay:.4s" x="170" y="36" width="10" height="10" rx="2" fill="#EECFBA"/>
<path class="pb-twinkle" d="M160 74 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill="#EECFBA"/><path class="pb-twinkle" style="animation-delay:1.2s" d="M34 76 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill="#EECFBA"/></g></svg>`,
  }[icon];
  return <div className={`[&>svg]:h-full [&>svg]:w-full ${className}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}
