import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import { DrinkForm } from "@/components/admin/DrinkForm";
import type { Drink } from "@/lib/types";

export const metadata: Metadata = { title: "Edit drink" };

const BLANK: Drink = {
  id: "new",
  name: "",
  description: "",
  category: "Drinks",
  image_url: null,
  accent_color: "#9DB27C",
  is_active: true,
  is_reward_eligible: true,
  is_sample: false,
  customization: [],
  sort_order: 100,
};

export default async function EditDrinkPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const { saved } = await searchParams;
  const { supabase } = await requireRole(["admin"], "/admin/drinks");
  let drink = BLANK;
  if (id !== "new") {
    if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
    const { data } = await supabase.from("drinks").select("*").eq("id", id).maybeSingle<Drink>();
    if (!data) notFound();
    drink = data;
  }
  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/drinks" className="font-semibold text-olive-deep">
          Drinks menu
        </Link>
      </p>
      <PageHeader title={id === "new" ? "Add a drink" : drink.name} />
      <DrinkForm drink={drink} justSaved={saved === "1"} />
    </>
  );
}
