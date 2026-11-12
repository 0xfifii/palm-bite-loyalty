"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { decideVisit } from "@/app/staff/actions";
import type { PendingVisit } from "@/app/api/visits/pending/route";

/**
 * Live list of Palm Frens who just scanned the counter code. Palm Staff
 * approve (adds the point) or decline. Refreshes every 2 seconds.
 */
export function VisitApprovals({ tone = "light" }: { tone?: "light" | "dark" }) {
  const [visits, setVisits] = useState<PendingVisit[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, start] = useTransition();
  const hidden = useRef(new Set<string>());

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/visits/pending", { cache: "no-store", credentials: "same-origin" });
      if (!res.ok) return;
      const data = (await res.json()) as { visits: PendingVisit[] };
      setVisits(data.visits.filter((v) => !hidden.current.has(v.id)));
      setLoaded(true);
    } catch {
      // try again on the next tick
    }
  }, []);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      await load();
      if (!stopped) timer = setTimeout(tick, 2000);
    };
    timer = setTimeout(tick, 0);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [load]);

  function decide(v: PendingVisit, approve: boolean) {
    setBusyId(v.id);
    start(async () => {
      const res = await decideVisit(v.id, approve);
      hidden.current.add(v.id);
      setVisits((list) => list.filter((x) => x.id !== v.id));
      setBusyId(null);
      if (res.ok && approve) {
        const d = res.data!;
        setFeedback({
          ok: true,
          text: d.rewardUnlocked ? `+1 for ${d.name}. That's 15! They've unlocked a free drink.` : `+1 for ${d.name}. Now ${d.points ?? ""} of 15.`,
        });
      } else if (res.ok) {
        setFeedback({ ok: true, text: res.message ?? "Declined." });
      } else {
        setFeedback({ ok: false, text: res.error });
      }
    });
  }

  const dark = tone === "dark";
  return (
    <section aria-labelledby="approvals-heading" className={dark ? "text-cream" : ""}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="approvals-heading" className="type-heading text-xl">
          Waiting for approval
        </h2>
        {visits.length > 0 && (
          <span className="grid size-8 place-items-center rounded-full bg-peach text-sm font-bold text-olive-night">{visits.length}</span>
        )}
      </div>

      <div aria-live="polite">
        {feedback && (
          <p
            className={`mt-3 rounded-2xl px-4 py-3 text-sm font-medium ${
              feedback.ok ? (dark ? "bg-cream/15" : "bg-sage-soft text-olive-night") : dark ? "bg-danger/80" : "bg-danger-soft text-danger"
            }`}
          >
            {feedback.text}
          </p>
        )}
      </div>

      {!loaded ? (
        <p className={`mt-3 text-sm ${dark ? "text-cream/70" : "text-muted"}`}>Loading...</p>
      ) : visits.length === 0 ? (
        <p className={`mt-3 rounded-2xl px-4 py-4 text-sm ${dark ? "bg-cream/10 text-cream/80" : "bg-surface text-muted"}`}>
          No one waiting. When a Palm Fren scans the code, their name appears here.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {visits.map((v) => (
            <li key={v.id} className={`animate-rise rounded-2xl p-4 ${dark ? "bg-cream text-ink" : "bg-surface"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="type-heading truncate text-lg">{v.name}</p>
                  <p className="tabular text-sm text-muted">
                    {v.phoneLast4 ? `Phone ending ${v.phoneLast4}, ` : ""}
                    {v.points} of 15 points
                  </p>
                </div>
                <Icon name="user" className="size-6 shrink-0 text-olive" />
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="olive" size="sm" icon="check" className="flex-1" disabled={busyId === v.id} onClick={() => decide(v, true)}>
                  {busyId === v.id ? "Saving..." : "Approve +1"}
                </Button>
                <Button variant="outline" size="sm" disabled={busyId === v.id} onClick={() => decide(v, false)}>
                  Decline
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
