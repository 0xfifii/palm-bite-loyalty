"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { QrCamera, type CameraStatus } from "@/components/scan/QrCamera";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Mark } from "@/components/brand/Logo";
import { CAMERA_ERROR_MESSAGE, SCAN_MESSAGES, type ScanCode } from "@/lib/loyalty/codes";
import { extractScannedToken } from "@/lib/qr/parse";
import { pad2 } from "@/lib/loyalty/progress";
import type { ScanResponse } from "@/lib/loyalty/scan-service";

type Phase =
  | { name: "intro" }
  | { name: "camera" }
  | { name: "verifying" }
  | { name: "waiting"; requestId: string }
  | { name: "result"; result: ScanResponse }
  | { name: "notPalmBite" };

const RETRYABLE = new Set([502, 503, 504]);

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

async function postScan(token: string, idempotencyKey: string): Promise<ScanResponse> {
  // Retries reuse the same idempotency key, so if an earlier attempt
  // committed, the server returns that result instead of awarding again.
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 600 * attempt));
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, idempotencyKey }),
        cache: "no-store",
        credentials: "same-origin",
      });
      if (RETRYABLE.has(res.status)) {
        lastError = new Error(`status ${res.status}`);
        continue;
      }
      const data = (await res.json()) as ScanResponse;
      if (data.code === "TEMPORARY_ERROR") {
        lastError = new Error("temporary");
        continue;
      }
      return data;
    } catch (e) {
      lastError = e;
    }
  }
  void lastError;
  const m = SCAN_MESSAGES.TEMPORARY_ERROR;
  return { code: "TEMPORARY_ERROR", title: m.title, message: m.body };
}

export function ScanExperience({
  initialToken,
  memberName,
  memberPhone,
}: {
  initialToken: string | null;
  memberName: string;
  memberPhone: string | null;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(initialToken ? { name: "verifying" } : { name: "intro" });
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("starting");
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const lastToken = useRef<string | null>(null);
  const keys = useRef(new Map<string, string>());
  const busy = useRef(false);

  const submit = useCallback(
    async (token: string) => {
      if (busy.current) return;
      busy.current = true;
      lastToken.current = token;
      setPhase({ name: "verifying" });
      if (!navigator.onLine) {
        const m = SCAN_MESSAGES.TEMPORARY_ERROR;
        setPhase({ name: "result", result: { code: "TEMPORARY_ERROR", title: "You're offline", message: `${m.body} Points can only be collected with a connection.` } });
        busy.current = false;
        return;
      }
      let key = keys.current.get(token);
      if (!key) {
        key = crypto.randomUUID();
        keys.current.set(token, key);
      }
      const result = await postScan(token, key);
      busy.current = false;
      if (result.code === "APPROVAL_PENDING" && result.requestId) {
        setPhase({ name: "waiting", requestId: result.requestId });
        return;
      }
      setPhase({ name: "result", result });
      if (result.code === "POINT_AWARDED") router.refresh();
    },
    [router],
  );

  // While waiting, check every 2 seconds whether Palm Staff have decided.
  const waitingId = phase.name === "waiting" ? phase.requestId : null;
  useEffect(() => {
    if (!waitingId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const res = await fetch(`/api/scan/status?id=${waitingId}`, { cache: "no-store", credentials: "same-origin" });
        if (res.ok) {
          const data = (await res.json()) as ScanResponse;
          if (stopped) return;
          if (data.code !== "APPROVAL_PENDING") {
            setPhase({ name: "result", result: data });
            if (data.code === "POINT_AWARDED") router.refresh();
            return;
          }
        }
      } catch {
        // keep waiting; the network may come back
      }
      if (!stopped) timer = setTimeout(poll, 2000);
    };
    timer = setTimeout(poll, 1500);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [waitingId, router]);

  // Arrived from the phone's own camera app with ?t=<token>.
  useEffect(() => {
    if (!initialToken) return;
    window.history.replaceState(null, "", "/scan");
    const t = setTimeout(() => void submit(initialToken), 0);
    return () => clearTimeout(t);
  }, [initialToken, submit]);

  const onDecode = useCallback(
    (text: string) => {
      const token = extractScannedToken(text);
      if (!token) {
        setPhase({ name: "notPalmBite" });
        return true;
      }
      void submit(token);
      return true;
    },
    [submit],
  );

  return (
    <main className="flex min-h-[calc(100dvh-7rem)] flex-col px-5 pt-[calc(var(--safe-top)+1.25rem)]">
      <header className="flex items-center justify-between">
        <Link href="/home" aria-label="Back to home" className="grid size-11 place-items-center rounded-full bg-surface shadow-soft">
          <Icon name="back" />
        </Link>
        <h1 className="type-heading text-lg">Scan &amp; Earn</h1>
        <span className="size-11" />
      </header>

      {!online && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-cream" role="status">
          <Icon name="wifiOff" className="size-5 shrink-0" />
          You&apos;re offline. Points can only be collected with an internet connection.
        </div>
      )}

      {phase.name === "intro" && (
        <section className="mt-6 flex flex-1 flex-col">
          <div className="rounded-[var(--radius-sheet)] bg-olive-deep p-6 text-cream">
            <Mark height={40} className="text-peach" />
            <h2 className="type-heading mt-5 text-[1.7rem]">Collect today&apos;s point</h2>
            <ol className="mt-5 space-y-3 text-cream/85">
              <li className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-cream/12 text-sm font-semibold">1</span>
                Find the Palm Bite code on the screen at the counter.
              </li>
              <li className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-cream/12 text-sm font-semibold">2</span>
                Tap the button below and allow camera access when asked.
              </li>
              <li className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-cream/12 text-sm font-semibold">3</span>
                Hold the code inside the frame, then show your screen to Palm Staff to approve your point.
              </li>
            </ol>
          </div>
          <p className="mt-4 text-sm text-muted">One point per day. Your camera is only used while this screen is open, and no images are saved.</p>
          <div className="mt-auto pt-6">
            <Button variant="dark" size="lg" icon="camera" full onClick={() => setPhase({ name: "camera" })} disabled={!online}>
              Open camera
            </Button>
          </div>
        </section>
      )}

      {phase.name === "camera" && (
        <section className="mt-5 flex flex-1 flex-col">
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[var(--radius-sheet)] bg-olive-night">
            <QrCamera className="absolute inset-0" onDecode={onDecode} onStatus={setCameraStatus} />
            {cameraStatus === "scanning" && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden="true">
                <div className="relative size-[68%]" style={{ ["--travel" as string]: "calc(100% - 4px)" }}>
                  {["top-0 left-0 border-t-4 border-l-4 rounded-tl-3xl", "top-0 right-0 border-t-4 border-r-4 rounded-tr-3xl", "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-3xl", "bottom-0 right-0 border-b-4 border-r-4 rounded-br-3xl"].map((c) => (
                    <span key={c} className={`absolute size-12 border-peach ${c}`} />
                  ))}
                  <span className="animate-scan-line absolute inset-x-3 top-0 h-0.5 rounded-full bg-peach/80 shadow-[0_0_12px_rgba(238,207,186,0.9)]" />
                </div>
              </div>
            )}
            {cameraStatus === "starting" && (
              <div className="absolute inset-0 grid place-items-center text-cream/80">Starting camera...</div>
            )}
            {(cameraStatus === "denied" || cameraStatus === "unavailable" || cameraStatus === "error") && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-cream" role="alert">
                <Icon name="camera" className="size-10 text-peach" />
                <p className="leading-relaxed">{CAMERA_ERROR_MESSAGE}</p>
                {cameraStatus === "denied" && (
                  <p className="text-sm text-cream/70">
                    To allow it, open your browser&apos;s site settings for this page, set Camera to Allow, then try again.
                  </p>
                )}
              </div>
            )}
          </div>
          <p className="mt-4 text-center text-muted">Point your camera at the Palm Bite code at the counter.</p>
          <div className="mt-auto flex flex-col gap-3 pt-6">
            {cameraStatus !== "scanning" && cameraStatus !== "starting" && (
              <Button variant="dark" size="lg" icon="refresh" full onClick={() => setPhase({ name: "intro" })}>
                Try again
              </Button>
            )}
            <StaffHelp name={memberName} phone={memberPhone} />
          </div>
        </section>
      )}

      {phase.name === "verifying" && (
        <section className="flex flex-1 flex-col items-center justify-center text-center" aria-live="polite">
          <div className="relative grid size-28 place-items-center">
            <span className="animate-ring absolute inset-0 rounded-full bg-olive/25" />
            <span className="grid size-24 place-items-center rounded-full bg-olive-deep text-peach">
              <Mark height={44} label="" />
            </span>
          </div>
          <p className="type-heading mt-6 text-xl">Verifying your visit</p>
          <p className="mt-1 text-muted">This only takes a moment.</p>
        </section>
      )}

      {phase.name === "waiting" && (
        <section className="flex flex-1 flex-col items-center justify-center text-center" aria-live="polite">
          <div className="relative grid size-32 place-items-center">
            <span className="animate-ring absolute inset-0 rounded-full bg-peach/50" />
            <span className="grid size-28 place-items-center rounded-full bg-olive-deep text-peach">
              <Mark height={50} label="" />
            </span>
          </div>
          <p className="type-heading mt-7 text-[1.6rem]">{SCAN_MESSAGES.APPROVAL_PENDING.title}</p>
          <p className="mt-2 max-w-xs leading-relaxed text-muted">{SCAN_MESSAGES.APPROVAL_PENDING.body}</p>
          <div className="mt-6 w-full rounded-[var(--radius-card)] bg-surface px-5 py-4">
            <p className="text-sm text-muted">Palm Fren</p>
            <p className="type-heading mt-1 text-2xl">{memberName}</p>
            {memberPhone && <p className="tabular text-sm text-muted">Phone ending {memberPhone.slice(-4)}</p>}
          </div>
          <p className="mt-4 text-sm text-muted">Keep this screen open. It updates by itself.</p>
        </section>
      )}

      {phase.name === "notPalmBite" && (
        <ResultPanel
          tone="error"
          title="That isn't the Palm Bite code"
          message={SCAN_MESSAGES.QR_INVALID.body}
          primary={{ label: "Scan again", onClick: () => setPhase({ name: "camera" }) }}
        />
      )}

      {phase.name === "result" && (
        <ResultView
          result={phase.result}
          onScanAgain={() => setPhase({ name: "camera" })}
          onRetry={() => lastToken.current && submit(lastToken.current)}
        />
      )}
    </main>
  );
}

function StaffHelp({ name, phone }: { name: string; phone: string | null }) {
  return (
    <details className="rounded-2xl bg-surface p-4 text-sm">
      <summary className="cursor-pointer font-semibold text-olive-deep">Camera not working?</summary>
      <p className="mt-2 leading-relaxed text-muted">
        Ask a team member to check you in. Show them this card so they can find your account.
      </p>
      <div className="mt-3 rounded-xl bg-cream px-4 py-3">
        <p className="font-semibold">{name}</p>
        {phone && <p className="tabular text-muted">Phone ending {phone.slice(-4)}</p>}
      </div>
    </details>
  );
}

function ResultView({ result, onScanAgain, onRetry }: { result: ScanResponse; onScanAgain: () => void; onRetry: () => void }) {
  const code = result.code as ScanCode;

  if (code === "POINT_AWARDED") {
    const points = result.account?.points ?? 0;
    return (
      <section className="flex flex-1 flex-col items-center justify-center text-center" aria-live="polite">
        <div className="relative grid size-36 place-items-center">
          <span className="animate-ring absolute inset-0 rounded-full bg-peach/60" />
          <span className="animate-stamp-pop stamp-bite grid size-32 place-items-center rounded-full bg-peach text-olive-deep">
            <Mark height={58} label="" />
          </span>
        </div>
        <p className="type-display mt-8 text-[3.2rem] text-olive-deep">{result.title}</p>
        <p className="mt-3 max-w-xs text-lg leading-relaxed text-ink/80">{result.message}</p>
        <p className="type-heading tabular mt-6 rounded-full bg-surface px-5 py-2 text-lg">{pad2(points)} / 15 visits</p>
        <div className="mt-auto flex w-full flex-col gap-3 pt-8">
          {result.rewardUnlocked ? (
            <>
              <p className="type-heading text-xl text-olive-deep">Your next drink is on us!</p>
              <ButtonLink href="/rewards" variant="olive" size="lg" trailingArrow full>
                Choose My Drink
              </ButtonLink>
            </>
          ) : (
            <ButtonLink href="/home" variant="dark" size="lg" full>
              Back to my card
            </ButtonLink>
          )}
        </div>
      </section>
    );
  }

  if (code === "REWARD_PENDING_REDEMPTION") {
    return (
      <ResultPanel tone="info" title={result.title} message={result.message} link={{ label: "Go to my reward", href: "/rewards" }} />
    );
  }

  if (code === "ALREADY_COLLECTED_TODAY") {
    return <ResultPanel tone="info" title={result.title} message={result.message} link={{ label: "Back to my card", href: "/home" }} />;
  }

  if (code === "UNAUTHENTICATED") {
    return <ResultPanel tone="info" title={result.title} message={result.message} link={{ label: "Sign in", href: "/login?next=/scan" }} />;
  }

  if (code === "TEMPORARY_ERROR") {
    return (
      <ResultPanel tone="error" title={result.title} message={result.message} primary={{ label: "Try again", onClick: onRetry }} />
    );
  }

  return <ResultPanel tone="error" title={result.title} message={result.message} primary={{ label: "Scan again", onClick: onScanAgain }} />;
}

function ResultPanel({
  tone,
  title,
  message,
  primary,
  link,
}: {
  tone: "info" | "error";
  title: string;
  message: string;
  primary?: { label: string; onClick: () => void };
  link?: { label: string; href: string };
}) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center text-center" role={tone === "error" ? "alert" : "status"}>
      <span
        className={`grid size-20 place-items-center rounded-full ${tone === "error" ? "bg-danger-soft text-danger" : "bg-sage-soft text-olive-deep"}`}
      >
        <Icon name={tone === "error" ? "alert" : "clock"} className="size-9" />
      </span>
      <h2 className="type-heading mt-6 text-[1.6rem]">{title}</h2>
      <p className="mt-3 max-w-xs leading-relaxed text-muted">{message}</p>
      <div className="mt-auto flex w-full flex-col gap-3 pt-8">
        {primary && (
          <Button variant="dark" size="lg" full onClick={primary.onClick}>
            {primary.label}
          </Button>
        )}
        {link && (
          <ButtonLink href={link.href} variant={primary ? "outline" : "dark"} size="lg" full>
            {link.label}
          </ButtonLink>
        )}
        {!link && (
          <ButtonLink href="/home" variant="outline" size="lg" full>
            Back to my card
          </ButtonLink>
        )}
      </div>
    </section>
  );
}
