import { Analytics } from "@/components/site/Analytics";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { StructuredData } from "@/components/site/StructuredData";
import { TopBar } from "@/components/site/TopBar";
import {
  getActiveAnnouncement,
  getSettings,
  getWorkingHours,
} from "@/server/queries/settings";

/**
 * Content is owner-editable and must appear without a redeploy, so the public
 * shell is rendered per request from the database.
 */
export const dynamic = "force-dynamic";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, hours, announcement] = await Promise.all([
    getSettings(),
    getWorkingHours(),
    getActiveAnnouncement(),
  ]);

  const phoneHref = settings.phone
    ? `tel:${settings.phone.replace(/[^\d+]/g, "")}`
    : "#";

  return (
    <>
      <StructuredData settings={settings} hours={hours} />
      <TopBar text={settings.topbarText} announcement={announcement} />
      <Header
        businessName={settings.businessName}
        tagline={settings.tagline}
        phone={settings.phone}
        phoneHref={phoneHref}
      />
      <main id="main">{children}</main>
      <Footer settings={settings} hours={hours} />
      <Analytics />
    </>
  );
}
