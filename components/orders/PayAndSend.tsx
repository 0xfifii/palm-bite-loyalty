"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { naira } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { goAhead, submitReceipt } from "@/app/(customer)/order/actions";
import type { BusinessSettings, Order } from "@/lib/types";

/** Palm Bite's account details with a one-tap copy of the number. */
export function BankCard({ business, total }: { business: Pick<BusinessSettings, "bank_name" | "bank_account_name" | "bank_account_number">; total?: number }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(business.bank_account_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="rounded-[var(--radius-card)] bg-olive-deep p-5 text-cream">
      <p className="flex items-center gap-2 text-sm font-semibold text-peach">
        <Icon name="bank" className="size-4" /> Pay by bank transfer
      </p>
      {typeof total === "number" && (
        <p className="mt-2 text-sm text-cream/80">
          Amount: <span className="tabular font-semibold text-cream">{naira(total)}</span>
        </p>
      )}
      <dl className="mt-3 space-y-1">
        <div className="flex justify-between gap-3">
          <dt className="text-cream/70">Bank</dt>
          <dd className="font-semibold">{business.bank_name}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-cream/70">Account name</dt>
          <dd className="font-semibold">{business.bank_account_name}</dd>
        </div>
      </dl>
      <button
        type="button"
        onClick={() => void copy()}
        className="mt-3 flex w-full items-center justify-between rounded-2xl bg-cream/10 px-4 py-3 text-left active:scale-[0.99]"
        aria-label={`Copy account number ${business.bank_account_number}`}
      >
        <span className="type-heading tabular text-2xl tracking-wider">{business.bank_account_number}</span>
        <span className="flex items-center gap-1.5 text-sm font-semibold text-peach">
          <Icon name={copied ? "check" : "copy"} className="size-4" /> {copied ? "Copied" : "Copy"}
        </span>
      </button>
      <p className="mt-3 text-xs text-cream/70">After paying, upload your receipt below so the team can confirm it quickly.</p>
    </div>
  );
}

const TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];

/** Uploads a transfer receipt (photo, screenshot or PDF) for an order. */
export function ReceiptUpload({ orderId, userId, status }: { orderId: string; userId: string; status: Order["payment_status"] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "uploading" | "done" | "error">(status === "receipt_sent" ? "done" : "idle");
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    if (!TYPES.includes(file.type) && !/\.(jpe?g|png|webp|heic|heif|pdf)$/i.test(file.name)) {
      setError("Please choose a photo, screenshot or PDF of your receipt.");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setError("That file is too big. Please use one under 6 MB, for example a screenshot.");
      return;
    }
    setState("uploading");
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
    const path = `${userId}/${orderId}-${Date.now()}.${ext}`;
    const { error: upErr } = await createClient().storage.from("order-receipts").upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (upErr) {
      setState("error");
      setError("Upload didn't go through. Check your connection and try again.");
      return;
    }
    const res = await submitReceipt(orderId, path);
    if (!res.ok) {
      setState("error");
      setError(res.error ?? "Couldn't attach the receipt.");
      return;
    }
    setState("done");
    router.refresh();
  }

  if (status === "paid") {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-sage-soft px-4 py-3 text-sm font-semibold text-olive-night">
        <Icon name="check" className="size-4" /> Payment received. Thank you!
      </p>
    );
  }
  return (
    <div>
      <input
        ref={input}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={state === "uploading"}
        className={`flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold active:scale-[0.98] ${
          state === "done" ? "border-2 border-olive-deep text-olive-deep" : "bg-peach text-olive-night"
        }`}
      >
        <Icon name={state === "done" ? "check" : "upload"} className="size-4" />
        {state === "uploading" ? "Uploading receipt..." : state === "done" ? "Receipt sent. Upload a different one" : "Upload payment receipt"}
      </button>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {state === "done" && !error && <p className="mt-2 text-sm text-muted">The team will check it and mark your order as paid.</p>}
    </div>
  );
}

/** Tells the Palm Bite team to go ahead with the order. */
export function GoAheadButton({ orderId, sentAt }: { orderId: string; sentAt: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [sent, setSent] = useState(Boolean(sentAt));
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await goAhead(orderId);
            if (res.ok) {
              setSent(true);
              setMsg("Palm Bite has been told to go ahead.");
              router.refresh();
            } else setMsg(res.error ?? "Couldn't reach Palm Bite.");
          })
        }
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink text-sm font-semibold text-cream active:scale-[0.98]"
      >
        <Icon name="flame" className="size-4" /> {pending ? "Telling Palm Bite..." : sent ? "Tell Palm Bite again" : "Tell Palm Bite to go ahead"}
      </button>
      {msg && (
        <p className="mt-2 text-center text-sm text-muted" aria-live="polite">
          {msg}
        </p>
      )}
    </div>
  );
}
