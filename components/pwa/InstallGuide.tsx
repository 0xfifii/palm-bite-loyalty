"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const noopSubscribe = () => () => undefined;
function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Add-to-home-screen guidance: a native prompt on Android and desktop Chrome, steps for iPhone. */
export function InstallGuide() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [justInstalled, setJustInstalled] = useState(false);
  const standalone = useSyncExternalStore(noopSubscribe, isStandalone, () => false);
  const platform = useSyncExternalStore(noopSubscribe, () => (/iphone|ipad|ipod/i.test(navigator.userAgent) ? "ios" : "other"), () => "other");
  const installed = standalone || justInstalled;

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setJustInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) {
    return <p className="text-sm text-muted">Palm Bite Loyalty is installed on this device.</p>;
  }

  return (
    <div className="space-y-3 text-sm leading-relaxed text-muted">
      <p>Add Palm Bite Loyalty to your home screen to open your card in one tap.</p>
      {deferred ? (
        <Button
          variant="olive"
          size="sm"
          icon="install"
          onClick={async () => {
            await deferred.prompt();
            await deferred.userChoice;
            setDeferred(null);
          }}
        >
          Install app
        </Button>
      ) : platform === "ios" ? (
        <ol className="list-inside list-decimal space-y-1">
          <li>Open this page in Safari.</li>
          <li>
            Tap the Share button <Icon name="install" className="inline size-4 rotate-180 align-[-2px]" />.
          </li>
          <li>Choose Add to Home Screen, then Add.</li>
        </ol>
      ) : (
        <p>In your browser menu, choose Install app or Add to Home screen.</p>
      )}
    </div>
  );
}
