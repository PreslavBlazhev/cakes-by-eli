import { PageHeader } from "@/components/admin/ui";
import { ContentForm } from "./ContentForm";
import { listImageLibrary } from "@/server/queries/gallery";
import { getSettings } from "@/server/queries/settings";

export const dynamic = "force-dynamic";

export const metadata = { title: "Текстове на сайта" };

export default async function AdminContentPage() {
  // The first screen picks its photographs from everything the site already
  // holds, so the library is loaded here beside the copy.
  const [settings, library] = await Promise.all([
    getSettings(),
    listImageLibrary(),
  ]);

  return (
    <>
      <PageHeader
        title="Текстове на сайта"
        description="Всички текстове от началната страница, подредени отгоре надолу както се виждат в сайта, и данните за контакт. Промените излизат в сайта веднага след „Запази“."
      />
      <ContentForm settings={settings} library={library} />
    </>
  );
}
