"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { cancelMyRedemption } from "./actions";

export function ChangeDrinkButton({ reference }: { reference: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  if (!confirming) {
    return (
      <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
        Change drink
      </Button>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Cancel this request and choose again? Your reward stays yours.</p>
      <div className="flex justify-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
          Keep it
        </Button>
        <Button
          variant="dark"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await cancelMyRedemption(reference);
              if (res.error) setError(res.error);
              else router.refresh();
            })
          }
        >
          {pending ? "Cancelling..." : "Choose again"}
        </Button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
