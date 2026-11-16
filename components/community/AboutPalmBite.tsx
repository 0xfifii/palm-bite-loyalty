import { Mark } from "@/components/brand/Logo";
import { Icon } from "@/components/ui/Icon";

/** The About Palm Bite story card. */
export function AboutPalmBite({ address }: { address: string }) {
  return (
    <section className="overflow-hidden rounded-[var(--radius-sheet)] bg-olive text-cream" aria-labelledby="about-heading">
      <div className="relative h-44">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/photos/palms-frappuccino.jpg" alt="A Palms Frappuccino topped with cream and chocolate" className="h-full w-full object-cover object-[50%_30%]" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-olive via-olive/30 to-transparent" />
        <span className="absolute bottom-3 left-5 text-peach">
          <Mark height={34} label="" />
        </span>
      </div>
      <div className="px-5 pt-3 pb-5">
        <p className="text-sm font-semibold text-peach">pour. sip. stay a while.</p>
        <h2 id="about-heading" className="type-heading mt-1 text-2xl">
          About Palm Bite
        </h2>
        <p className="mt-2 leading-relaxed text-cream/90">
          Palm Bite is where good coffee, fresh juice and real food meet good people. Sip our signature Gems, share a Slab, and stay a while. It&apos;s Palm way, our way.
        </p>
        <ul className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          {[
            ["cup", "Gems and fresh juice"],
            ["bag", "Slab and pastries"],
            ["people", "Clubs and events"],
          ].map(([icon, text]) => (
            <li key={text} className="rounded-2xl bg-cream/10 px-2 py-3">
              <Icon name={icon as "cup"} className="mx-auto mb-1 size-5 text-peach" />
              {text}
            </li>
          ))}
        </ul>
        <p className="mt-4 flex items-center gap-2 text-sm text-cream/85">
          <Icon name="pin" className="size-4 text-peach" /> {address}
        </p>
      </div>
    </section>
  );
}
