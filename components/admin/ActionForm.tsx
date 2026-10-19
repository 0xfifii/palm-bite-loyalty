"use client";

import { useActionState } from "react";
import { Notice } from "@/components/ui/Field";
import type { ActionState } from "@/app/admin/actions";

/** Wraps an admin server action with inline success and error feedback. */
export function ActionForm({
  action,
  children,
  className = "space-y-3",
  encType,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  encType?: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  return (
    <form action={formAction} className={className} encType={encType}>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.ok && state.message && <Notice tone="success">{state.message}</Notice>}
      {children}
    </form>
  );
}
