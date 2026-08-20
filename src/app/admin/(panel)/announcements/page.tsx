import { PageHeader } from "@/components/admin/ui";
import { AnnouncementManager } from "./AnnouncementManager";
import { listAnnouncements } from "@/server/queries/settings";

export const dynamic = "force-dynamic";

export const metadata = { title: "Съобщения" };

export default async function AdminAnnouncementsPage() {
  const announcements = await listAnnouncements();

  return (
    <>
      <PageHeader
        title="Съобщения"
        description="Лента най-горе в сайта — за временни известия като „Не приемаме поръчки за 24–26 декември“."
      />
      <AnnouncementManager
        announcements={announcements.map((item) => ({
          id: item.id,
          text: item.text,
          linkUrl: item.linkUrl,
          linkLabel: item.linkLabel,
          isActive: item.isActive,
          startsAt: item.startsAt?.toISOString().slice(0, 10) ?? "",
          endsAt: item.endsAt?.toISOString().slice(0, 10) ?? "",
        }))}
      />
    </>
  );
}
