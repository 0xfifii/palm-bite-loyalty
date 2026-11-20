import type { Metadata } from "next";
import { NotificationCheck } from "./NotificationCheck";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-5 pt-[calc(var(--safe-top)+1.25rem)] pb-8 md:px-8">
      <h1 className="type-heading text-3xl">Notifications</h1>
      <p className="mt-2 text-muted">Check that this phone can receive Palm Bite order notifications, even when you are in another app.</p>
      <NotificationCheck />
    </main>
  );
}
