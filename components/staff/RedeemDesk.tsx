"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { QrCamera } from "@/components/scan/QrCamera";
import { describeCustomizations } from "@/lib/format";
import { cancelRedemption, completeRedemption, lookupRedemption, type RedemptionDetails } from "@/app/staff/actions";

export function RedeemDesk({ initialReference = "" }: { initialReference?: string }) {
  const router = useRouter();
  const [reference, setReference] = useState(initialReference);
  const [details, setDetails] = useState<RedemptionDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  const autoLooked = useRef(false);
  useEffect(() => {
    if (initialReference && !autoLooked.current) {
      autoLooked.current = true;
      find(initialReference);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialReference]);

  function reset() {
    setDetails(null);
    setError(null);
    setConfirming(false);
    setCancelling(false);
    setReason("");
  }

  function find(ref = reference) {
    reset();
    setSuccess(null);
    start(async () => {
      const res = await lookupRedemption(ref);
      if (res.ok) {
        setDetails(res.data!);
        setReference(res.data!.reference);
      } else setError(res.error);
    });
  }

  function serve() {
    if (!details) return;
    start(async () => {
      const res = await completeRedemption(details.reference);
      if (res.ok) {
        setSuccess(`${details.drink_name} served to ${details.customer_name}. Their card has been reset to zero and a new card has started.`);
        reset();
        setReference("");
        router.refresh();
      } else {
        setError(res.error);
        setConfirming(false);
        const again = await lookupRedemption(details.reference);
        if (again.ok) setDetails(again.data!);
      }
    });
  }

  function cancel() {
    if (!details) return;
    start(async () => {
      const res = await cancelRedemption(details.reference, reason);
      if (res.ok) {
        setSuccess(res.message ?? "Cancelled.");
        reset();
        setReference("");
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <div className="rounded-[var(--radius-sheet)] bg-surface p-5 sm:p-7">
      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          find();
        }}
      >
        <label className="sr-only" htmlFor="reference">
          Redemption code
        </label>
        <input
          id="reference"
          value={reference}
          onChange={(e) => setReference(e.target.value.toUpperCase())}
          placeholder="PB-7K3Q9X"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="type-heading tabular h-14 flex-1 rounded-2xl border border-line bg-cream px-5 text-xl tracking-wider outline-none focus:border-olive focus:ring-4 focus:ring-olive/15"
        />
        <div className="flex gap-2">
          <Button type="submit" variant="dark" size="lg" icon="search" disabled={pending || reference.trim().length < 6} className="flex-1">
            Find
          </Button>
          <Button type="button" variant="outline" size="lg" icon="camera" onClick={() => setScanning((s) => !s)} aria-pressed={scanning}>
            Scan
          </Button>
        </div>
      </form>

      {scanning && (
        <div className="mt-4">
          <QrCamera
            className="aspect-video w-full rounded-2xl"
            onDecode={(text) => {
              const value = text.trim().toUpperCase();
              if (!/^PB-[0-9A-Z]{6}$/.test(value)) return false;
              setScanning(false);
              setReference(value);
              find(value);
              return true;
            }}
          />
          <p className="mt-2 text-sm text-muted">Point the camera at the code on the customer&apos;s Rewards screen.</p>
        </div>
      )}

      <div className="mt-4 space-y-3" aria-live="polite">
        {success && <Notice tone="success">{success}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
      </div>

      {details && (
        <div className="mt-5 overflow-hidden rounded-2xl border border-line">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-sage-mist px-5 py-4">
            <p className="type-heading tabular text-xl">{details.reference}</p>
            <Badge tone={details.status === "pending" ? "olive" : details.status === "completed" ? "sage" : "muted"}>
              {details.status === "pending" ? "Awaiting confirmation" : details.status === "completed" ? "Already redeemed" : "Cancelled"}
            </Badge>
          </div>
          <dl className="grid gap-4 p-5 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted">Drink to serve</dt>
              <dd className="type-heading mt-1 text-2xl">{details.drink_name}</dd>
              {Object.keys(details.customizations ?? {}).length > 0 && (
                <dd className="mt-1 text-sm">{describeCustomizations(details.customizations)}</dd>
              )}
            </div>
            <div>
              <dt className="text-sm text-muted">Customer</dt>
              <dd className="mt-1 font-semibold">{details.customer_name}</dd>
              {details.customer_phone_last4 && <dd className="tabular text-sm text-muted">Phone ending {details.customer_phone_last4}</dd>}
              <dd className="text-sm text-muted">Card {details.cycle_number}, reward {details.reward_reference}</dd>
            </div>
          </dl>

          {!details.ownership_ok && (
            <div className="px-5 pb-4">
              <Notice tone="error">This code does not match the reward owner. Do not serve.</Notice>
            </div>
          )}
          {details.account_status !== "active" && (
            <div className="px-5 pb-4">
              <Notice tone="error">This account is suspended. Do not serve.</Notice>
            </div>
          )}

          {details.status === "pending" && details.ownership_ok && details.account_status === "active" && (
            <div className="border-t border-line p-5">
              {!confirming && !cancelling && (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button variant="olive" size="lg" icon="check" onClick={() => setConfirming(true)} className="flex-1">
                    Confirm drink served
                  </Button>
                  <Button variant="ghost" size="lg" onClick={() => setCancelling(true)}>
                    Cancel request
                  </Button>
                </div>
              )}
              {confirming && (
                <div className="rounded-2xl bg-peach-soft p-4">
                  <p className="font-semibold">Has {details.customer_name} received their {details.drink_name}?</p>
                  <p className="mt-1 text-sm text-muted">This completes the reward and resets their card to zero.</p>
                  <div className="mt-4 flex gap-2">
                    <Button variant="olive" onClick={serve} disabled={pending} aria-busy={pending}>
                      {pending ? "Confirming..." : "Yes, drink served"}
                    </Button>
                    <Button variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
                      Not yet
                    </Button>
                  </div>
                </div>
              )}
              {cancelling && (
                <div className="rounded-2xl bg-cream p-4">
                  <label htmlFor="cancel-reason" className="font-semibold">
                    Why are you cancelling this request?
                  </label>
                  <p className="text-sm text-muted">The customer keeps their reward and can choose again.</p>
                  <input
                    id="cancel-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={280}
                    placeholder="For example: drink unavailable today"
                    className="mt-3 h-12 w-full rounded-xl border border-line bg-surface px-4 outline-none focus:border-olive"
                  />
                  <div className="mt-3 flex gap-2">
                    <Button variant="danger" onClick={cancel} disabled={pending || reason.trim().length < 3}>
                      {pending ? "Cancelling..." : "Cancel request"}
                    </Button>
                    <Button variant="ghost" onClick={() => setCancelling(false)} disabled={pending}>
                      Keep request
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!details && !error && !success && (
        <p className="mt-5 flex items-center gap-2 text-sm text-muted">
          <Icon name="gift" className="size-4" /> Enter or scan the code the customer shows you.
        </p>
      )}
    </div>
  );
}
