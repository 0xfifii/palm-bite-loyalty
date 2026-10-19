import Link from "next/link";
import { Mark } from "@/components/brand/Logo";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-cream px-6 text-center">
      <div>
        <Mark height={56} className="text-olive" />
        <h1 className="type-heading mt-8 text-[1.8rem]">Page not found</h1>
        <p className="mt-3 text-muted">The page you opened doesn&apos;t exist or has moved.</p>
        <Link href="/" className="mt-8 inline-flex h-12 items-center rounded-full bg-ink px-6 font-semibold text-cream">
          Go to Palm Bite Loyalty
        </Link>
      </div>
    </main>
  );
}
