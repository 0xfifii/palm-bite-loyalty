/**
 * Browser install ("Add to Home Screen") state, shared by every install
 * button. The beforeinstallprompt event can fire before any button mounts,
 * so it is captured as soon as this module loads (it is imported by the root
 * layout's ServiceWorker component).
 */
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferred: InstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installedNow = true;
    emit();
  });
}

export function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export const canPromptSnapshot = () => deferred !== null;

export function isInstalledSnapshot(): boolean {
  if (installedNow) return true;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export type InstallPlatform = "ios-safari" | "ios-other" | "android" | "desktop";

export function platformSnapshot(): InstallPlatform {
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios) return /crios|fxios|edgios|opios/i.test(ua) ? "ios-other" : "ios-safari";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

/** Shows the browser's own install prompt. Returns true when the person installed. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const event = deferred;
  await event.prompt();
  const choice = await event.userChoice;
  deferred = null;
  emit();
  return choice.outcome === "accepted";
}
