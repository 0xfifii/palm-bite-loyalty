import type { Metadata } from "next";
import { CheckInDesk } from "@/components/staff/CheckInDesk";

export const metadata: Metadata = { title: "Check in a customer" };

export default function StaffCheckInPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="type-heading text-[1.9rem]">Check in a customer</h1>
      <p className="mt-1 mb-5 text-muted">For guests who can&apos;t scan the visit code. The same one-point-a-day rule applies.</p>
      <CheckInDesk />
    </div>
  );
}
