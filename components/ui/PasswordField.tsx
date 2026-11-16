"use client";

import { useId, useState } from "react";
import { Icon } from "./Icon";

/** Password input with a Show / Hide button. */
export function PasswordField({
  label,
  error,
  hint,
  id,
  ...rest
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string; error?: string; hint?: string }) {
  const auto = useId();
  const inputId = id ?? auto;
  const [show, setShow] = useState(false);
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={show ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={`h-13 w-full rounded-2xl border bg-surface pr-24 pl-4 text-base text-ink outline-none transition-colors focus:border-olive focus:ring-4 focus:ring-olive/15 ${
            error ? "border-danger" : "border-line"
          }`}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          className="absolute top-1/2 right-2 flex h-9 -translate-y-1/2 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-olive-deep hover:bg-sage-mist"
        >
          <Icon name={show ? "eyeOff" : "eye"} className="size-4" />
          {show ? "Hide" : "Show"}
        </button>
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="mt-1.5 text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
