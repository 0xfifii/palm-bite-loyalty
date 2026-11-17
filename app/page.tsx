import { redirect } from "next/navigation";
import { getSession, homeFor } from "@/lib/auth";
import { Welcome } from "@/components/welcome/Welcome";
import { JsonLd } from "@/components/seo/JsonLd";
import { SAME_AS, SITE_DESCRIPTION, SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/seo";

export default async function Page() {
  const { user, profile } = await getSession();
  if (user && profile?.status === "active") redirect(homeFor(profile.role));
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "CafeOrCoffeeShop",
              "@id": `${SITE_URL}/#cafe`,
              name: SITE_NAME,
              alternateName: ["Palm Bite", "Palmbite"],
              description: SITE_DESCRIPTION,
              slogan: "pour. sip. stay a while.",
              url: SITE_URL,
              logo: absoluteUrl("/icons/icon-512.png"),
              image: [absoluteUrl("/photos/melis.jpg"), absoluteUrl("/photos/palms-frappuccino-2.jpg"), absoluteUrl("/photos/croissant.jpg")],
              servesCuisine: ["Coffee", "Juice", "Pastries", "Cafe food"],
              priceRange: "\u20a6\u20a6",
              currenciesAccepted: "NGN",
              hasMenu: absoluteUrl("/menu"),
              acceptsReservations: false,
              address: { "@type": "PostalAddress", streetAddress: "Palm View, along UBA Gate", addressRegion: "Ekiti", addressCountry: "NG" },
              sameAs: SAME_AS,
              keywords: "social community cafe, coffee, fresh juice, pastries, book club, fitness club",
            },
            {
              "@type": "WebSite",
              "@id": `${SITE_URL}/#website`,
              url: SITE_URL,
              name: SITE_NAME,
              publisher: { "@id": `${SITE_URL}/#cafe` },
              inLanguage: "en-NG",
            },
          ],
        }}
      />
      <Welcome />
    </>
  );
}
