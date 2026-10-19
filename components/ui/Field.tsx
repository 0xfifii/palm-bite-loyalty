import { useId } from "react";

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export function Field({ label, error, hint, className = "", id, ...rest }: FieldProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`h-13 w-full rounded-2xl border bg-surface px-4 text-base text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-olive focus:ring-4 focus:ring-olive/15 ${
          error ? "border-danger" : "border-line"
        }`}
        {...rest}
      />
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

export function TextArea({
  label,
  error,
  hint,
  id,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string; hint?: string }) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <textarea
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={`w-full rounded-2xl border bg-surface px-4 py-3 text-base text-ink outline-none focus:border-olive focus:ring-4 focus:ring-olive/15 ${
          error ? "border-danger" : "border-line"
        }`}
        {...rest}
      />
      {error ? <p className="mt-1.5 text-sm text-danger">{error}</p> : hint ? <p className="mt-1.5 text-sm text-muted">{hint}</p> : null}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "success"; children: React.ReactNode }) {
  const styles = {
    info: "bg-sage-mist text-olive-night",
    error: "bg-danger-soft text-danger",
    success: "bg-sage-soft text-olive-night",
  } as const;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${styles[tone]}`}>
      {children}
    </div>
  );
}
