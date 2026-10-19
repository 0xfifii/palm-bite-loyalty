import { Mark } from "@/components/brand/Logo";
import { signOutAction } from "@/app/(auth)/actions";

export default function SuspendedPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-cream px-6 text-center">
      <div className="max-w-sm">
        <Mark height={56} className="text-olive" />
        <h1 className="type-heading mt-8 text-[1.8rem]">Your account is paused</h1>
        <p className="mt-3 leading-relaxed text-muted">
          Your points and rewards are kept safe. Please speak with a Palm Bite team member to reactivate your card.
        </p>
        <form action={signOutAction} className="mt-8">
          <button className="h-12 rounded-full bg-ink px-6 font-semibold text-cream">Sign out</button>
        </form>
      </div>
    </main>
  );
}
