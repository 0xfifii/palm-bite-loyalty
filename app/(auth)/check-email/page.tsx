import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

export default async function CheckEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return (
    <div className="text-center">
      <div className="mx-auto grid size-16 place-items-center rounded-full bg-sage-soft text-olive-deep">
        <Icon name="check" className="size-8" />
      </div>
      <h1 className="type-heading mt-6 text-[1.9rem]">Check your inbox</h1>
      <p className="mx-auto mt-3 max-w-xs leading-relaxed text-muted">
        We sent a confirmation link{email ? <> to <strong className="text-ink">{email}</strong></> : null}. Open it on this
        phone to activate your Palm Bite card.
      </p>
      <p className="mt-8 text-sm text-muted">
        Already confirmed?{" "}
        <Link href="/login" className="font-semibold text-olive-deep underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}
