"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { Icon, type IconName } from "./Icon";

type Variant = "dark" | "olive" | "outline" | "ghost" | "peach" | "danger" | "light";

const variants: Record<Variant, string> = {
  dark: "bg-ink text-cream hover:bg-olive-night",
  olive: "bg-olive-deep text-cream hover:bg-olive-night",
  outline: "border border-ink/15 bg-surface text-ink hover:border-ink/35",
  ghost: "text-ink hover:bg-ink/5",
  peach: "bg-peach text-olive-night hover:bg-peach-deep",
  danger: "bg-danger text-white hover:brightness-110",
  light: "bg-cream text-olive-night hover:bg-white",
};

const base =
  "relative inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold transition-[background,color,border,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

const sizes = {
  md: "h-12 px-6 text-[0.95rem]",
  lg: "h-14 px-7 text-base",
  sm: "h-10 px-4 text-sm",
};

type CommonProps = {
  variant?: Variant;
  size?: keyof typeof sizes;
  icon?: IconName;
  /** Reference-style trailing arrow in its own circle. */
  trailingArrow?: boolean;
  full?: boolean;
  className?: string;
  children: React.ReactNode;
};

function Inner({ icon, trailingArrow, children, variant }: Pick<CommonProps, "icon" | "trailingArrow" | "children" | "variant">) {
  return (
    <>
      {icon && <Icon name={icon} className="size-5" />}
      <span className={trailingArrow ? "flex-1 text-left" : undefined}>{children}</span>
      {trailingArrow && (
        <span
          className={`-mr-3 grid size-10 place-items-center rounded-full ${
            variant === "dark" || variant === "olive" ? "bg-cream/12 text-cream" : "bg-ink/6"
          }`}
        >
          <Icon name="arrow" className="size-5" />
        </span>
      )}
    </>
  );
}

export function Button({
  variant = "dark",
  size = "md",
  icon,
  trailingArrow,
  full,
  className = "",
  children,
  ...rest
}: CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${full ? "w-full" : ""} ${className}`} {...rest}>
      <Inner icon={icon} trailingArrow={trailingArrow} variant={variant}>
        {children}
      </Inner>
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "dark",
  size = "md",
  icon,
  trailingArrow,
  full,
  className = "",
  children,
  prefetch,
}: CommonProps & { href: string; prefetch?: boolean }) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={`${base} ${variants[variant]} ${sizes[size]} ${full ? "w-full" : ""} ${className}`}
    >
      <Inner icon={icon} trailingArrow={trailingArrow} variant={variant}>
        {children}
      </Inner>
    </Link>
  );
}

/** Submit button that disables itself and shows progress while a form action runs. */
export function SubmitButton({
  children,
  pendingLabel,
  ...props
}: CommonProps & { pendingLabel?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending ? (pendingLabel ?? "Working...") : children}
    </Button>
  );
}
