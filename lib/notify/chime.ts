"use client";

let ctx: AudioContext | null = null;

/** Browsers only allow sound after a tap: call this from any tap. */
export function unlockSound() {
  try {
    if (!ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new Ctx();
    }
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

export function soundReady() {
  return Boolean(ctx && ctx.state === "running");
}

/** A short three-note Palm Bite chime. `loud` repeats it for new orders. */
export function chime(loud = false) {
  if (!ctx || ctx.state !== "running") return;
  const c = ctx;
  const notes = loud ? [880, 1175, 1568, 880, 1175, 1568] : [988, 1319];
  notes.forEach((f, i) => {
    const t = c.currentTime + i * 0.18 + (loud && i >= 3 ? 0.35 : 0);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.32);
  });
}
