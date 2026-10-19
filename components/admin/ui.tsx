import Link from "next/link";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="type-heading text-[2rem] text-olive-night">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, action, children, className = "" }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-[var(--radius-card)] bg-surface p-5 sm:p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="type-heading text-lg">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Metric({ label, value, hint, href, emphasis = false }: { label: string; value: number | string; hint?: string; href?: string; emphasis?: boolean }) {
  const body = (
    <>
      <p className={`text-sm ${emphasis ? "text-cream/75" : "text-muted"}`}>{label}</p>
      <p className="type-heading tabular mt-2 text-[2.1rem] leading-none">{value}</p>
      {hint && <p className={`mt-2 text-xs ${emphasis ? "text-cream/65" : "text-muted"}`}>{hint}</p>}
    </>
  );
  const cls = `block rounded-[var(--radius-card)] p-5 ${emphasis ? "bg-olive-deep text-cream" : "bg-surface"} ${href ? "transition-colors hover:ring-2 hover:ring-olive/25" : ""}`;
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: string }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div className="-mx-5 overflow-x-auto sm:mx-0">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line text-muted">
            {head.map((h) => (
              <th key={h} scope="col" className="px-5 py-3 font-medium sm:px-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {hasRows ? (
            children
          ) : (
            <tr>
              <td colSpan={head.length} className="px-3 py-8 text-center text-muted">
                {empty ?? "Nothing to show yet."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-5 py-3 align-top sm:px-3 ${className}`}>{children}</td>;
}
