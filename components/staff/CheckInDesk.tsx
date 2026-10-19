"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { searchCustomers, staffCheckIn, type CustomerRow } from "@/app/staff/actions";

/**
 * Staff-assisted visit check-in for customers who cannot scan. Uses the same
 * database rules as a QR scan: one point per business day, no points while a
 * reward is waiting.
 */
export function CheckInDesk() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [selected, setSelected] = useState<CustomerRow | null>(null);
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [searching, startSearch] = useTransition();
  const [saving, startSave] = useTransition();

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const t = setTimeout(() => {
      startSearch(async () => {
        const res = await searchCustomers(q);
        if (res.ok) setRows((res.data ?? []).filter((r) => r.role === "customer"));
      });
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const visibleRows = query.trim().length >= 2 ? rows : [];

  function checkIn() {
    if (!selected) return;
    startSave(async () => {
      const res = await staffCheckIn(selected.id, note);
      if (res.ok) {
        setFeedback({ tone: "success", text: `${res.message} ${selected.full_name} now has ${res.data!.points} of 15.` });
        setSelected(null);
        setNote("");
        setQuery("");
      } else {
        setFeedback({ tone: "error", text: res.error });
      }
    });
  }

  return (
    <div className="rounded-[var(--radius-sheet)] bg-surface p-5 sm:p-7">
      <label htmlFor="customer-search" className="font-semibold">
        Find the customer
      </label>
      <div className="relative mt-2">
        <Icon name="search" className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" />
        <input
          id="customer-search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(null);
            setFeedback(null);
          }}
          placeholder="Name, phone or email"
          autoComplete="off"
          className="h-14 w-full rounded-2xl border border-line bg-cream pr-4 pl-12 text-lg outline-none focus:border-olive focus:ring-4 focus:ring-olive/15"
        />
      </div>

      <div className="mt-4" aria-live="polite">
        {feedback && <Notice tone={feedback.tone}>{feedback.text}</Notice>}
      </div>

      {!selected && query.trim().length >= 2 && (
        <ul className="mt-3 divide-y divide-line">
          {searching && visibleRows.length === 0 && <li className="py-3 text-muted">Searching...</li>}
          {!searching && visibleRows.length === 0 && <li className="py-3 text-muted">No customers match. Check the spelling or try their phone number.</li>}
          {visibleRows.map((r) => (
            <li key={r.id}>
              <button onClick={() => setSelected(r)} className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-sage-mist/60">
                <div>
                  <p className="font-semibold">{r.full_name}</p>
                  <p className="tabular text-sm text-muted">{r.phone ? `Phone ending ${r.phone.slice(-4)}` : r.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {r.status !== "active" && <Badge tone="danger">Suspended</Badge>}
                  <Badge tone="sage">{r.current_points} / 15</Badge>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <div className="mt-4 rounded-2xl border border-line p-5">
          <p className="type-heading text-xl">{selected.full_name}</p>
          <p className="tabular text-sm text-muted">
            {selected.phone ? `Phone ending ${selected.phone.slice(-4)}` : selected.email}, {selected.current_points} of 15 points
          </p>
          <label htmlFor="checkin-note" className="mt-4 block text-sm font-medium">
            Reason (optional)
          </label>
          <input
            id="checkin-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={280}
            placeholder="For example: phone camera not working"
            className="mt-1.5 h-12 w-full rounded-xl border border-line px-4 outline-none focus:border-olive"
          />
          <p className="mt-3 text-sm text-muted">Only check in a customer who is here in person. Every check-in is recorded with your name.</p>
          <div className="mt-4 flex gap-2">
            <Button variant="olive" icon="check" onClick={checkIn} disabled={saving}>
              {saving ? "Adding..." : "Add today's point"}
            </Button>
            <Button variant="ghost" onClick={() => setSelected(null)} disabled={saving}>
              Back
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
