"use client";

import { useActionState, useState } from "react";
import { saveDrink, type ActionState } from "@/app/admin/actions";
import { Field, Notice, TextArea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/Button";
import { DrinkImage } from "@/components/drinks/DrinkImage";
import { customizationToText } from "@/lib/validation";
import type { Drink } from "@/lib/types";

export function DrinkForm({ drink, justSaved }: { drink: Drink; justSaved?: boolean }) {
  const [state, action] = useActionState<ActionState, FormData>(saveDrink, justSaved ? { ok: true, message: "Drink added." } : {});
  const [accent, setAccent] = useState(drink.accent_color);
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <form action={action} className="grid gap-6 xl:grid-cols-[1fr_20rem]">
      <input type="hidden" name="id" value={drink.id} />
      <div className="space-y-5 rounded-[var(--radius-card)] bg-surface p-6">
        {state.error && <Notice tone="error">{state.error}</Notice>}
        {state.ok && state.message && <Notice tone="success">{state.message}</Notice>}
        <Field label="Name" name="name" required maxLength={80} defaultValue={drink.name} />
        <TextArea label="Description" name="description" rows={3} maxLength={400} defaultValue={drink.description} />
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Category" name="category" required maxLength={40} defaultValue={drink.category} />
          <Field label="Menu order" name="sort_order" type="number" min={0} max={10000} defaultValue={drink.sort_order} hint="Lower numbers show first." />
          <div>
            <label htmlFor="accent" className="mb-1.5 block text-sm font-medium">
              Accent colour
            </label>
            <input
              id="accent"
              name="accent_color"
              type="color"
              value={accent}
              onChange={(e) => setAccent(e.target.value.toUpperCase())}
              className="h-13 w-full cursor-pointer rounded-2xl border border-line bg-surface p-1.5"
            />
          </div>
        </div>
        <TextArea
          label="Customization options"
          name="customization"
          rows={4}
          defaultValue={customizationToText(drink.customization)}
          hint="One group per line, for example  Milk: Whole, Oat, Skim. Add * after the group name to allow several choices, for example  Extras*: Extra shot, Vanilla."
        />
        <fieldset className="space-y-3">
          <legend className="mb-1 text-sm font-medium">Availability</legend>
          <label className="flex items-center gap-3">
            <input type="checkbox" name="is_active" defaultChecked={drink.is_active} className="size-5 accent-olive" />
            Show on the menu
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" name="is_reward_eligible" defaultChecked={drink.is_reward_eligible} className="size-5 accent-olive" />
            Can be chosen as a free reward drink
          </label>
          {drink.is_sample && (
            <label className="flex items-center gap-3">
              <input type="checkbox" name="clear_sample" className="size-5 accent-olive" />
              This is now a real Palm Bite drink (remove the Sample label)
            </label>
          )}
        </fieldset>
        <SubmitButton variant="olive" pendingLabel="Saving...">
          {drink.id === "new" ? "Add drink" : "Save drink"}
        </SubmitButton>
      </div>

      <aside className="space-y-4 rounded-[var(--radius-card)] bg-surface p-6">
        <p className="text-sm font-medium">Photo</p>
        <div className="mx-auto h-64 w-48 overflow-hidden rounded-2xl p-2" style={{ background: `${accent}2e` }}>
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="New photo preview" className="h-full w-full rounded-xl object-cover" />
          ) : (
            <DrinkImage name={drink.name || "Drink"} imageUrl={drink.image_url} accent={accent} id={`edit-${drink.id}`} />
          )}
        </div>
        <input
          type="file"
          name="image"
          accept="image/jpeg,image/png,image/webp,image/avif"
          aria-label="Upload a photo"
          onChange={(e) => {
            const f = e.target.files?.[0];
            setPreview(f ? URL.createObjectURL(f) : null);
          }}
          className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:font-semibold file:text-cream"
        />
        <p className="text-xs text-muted">JPEG, PNG, WebP or AVIF, up to 4 MB. Without a photo, the menu shows an illustration in the accent colour.</p>
        {drink.image_url && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="remove_image" className="size-4 accent-olive" />
            Remove current photo
          </label>
        )}
      </aside>
    </form>
  );
}
