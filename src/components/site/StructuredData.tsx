import { env } from "@/lib/env";
import { shortTime } from "@/lib/format";
import type { WorkingHourRow } from "@/lib/schedule";
import type { SiteSettings } from "@/server/queries/settings";

const DAY_NAMES: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

/**
 * LocalBusiness structured data.
 *
 * Only fields the client has actually confirmed are emitted — no invented
 * ratings, price ranges, review counts or awards.
 */
export function StructuredData({
  settings,
  hours,
}: {
  settings: SiteSettings;
  hours: WorkingHourRow[];
}) {
  const sameAs = [settings.facebookUrl, settings.instagramUrl].filter(Boolean);

  const openingHours = hours
    .filter((row) => !row.isClosed && row.opensAt && row.closesAt)
    .map((row) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: `https://schema.org/${DAY_NAMES[row.weekday]}`,
      opens: shortTime(row.opensAt),
      closes: shortTime(row.closesAt),
    }));

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Bakery",
    name: settings.businessName,
    url: env.APP_URL,
    image: `${env.APP_URL}/icon.svg`,
    currenciesAccepted: "EUR",
  };

  if (settings.metaDescription) data.description = settings.metaDescription;
  if (settings.phone) data.telephone = settings.phone;
  if (settings.email) data.email = settings.email;
  if (sameAs.length > 0) data.sameAs = sameAs;
  if (settings.mapsUrl) data.hasMap = settings.mapsUrl;
  if (openingHours.length > 0) data.openingHoursSpecification = openingHours;

  if (settings.addressLine || settings.city) {
    data.address = {
      "@type": "PostalAddress",
      addressCountry: "BG",
      addressLocality: settings.city || undefined,
      streetAddress: settings.addressLine || undefined,
    };
  }

  return (
    <script
      type="application/ld+json"
      // Values come from the owner-managed settings row and are serialised
      // with JSON.stringify, so no unescaped markup can reach the page.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
