import { PageHeader } from "@/components/admin/ui";
import { ContentForm } from "./ContentForm";
import { getSettings } from "@/server/queries/settings";

export const dynamic = "force-dynamic";

export const metadata = { title: "Съдържание на сайта" };

export default async function AdminContentPage() {
  const settings = await getSettings();

  return (
    <>
      <PageHeader
        title="Съдържание на сайта"
        description="Данните за контакт и текстовете, които клиентите виждат. Промените излизат в сайта веднага."
      />
      <ContentForm settings={settings} />
    </>
  );
}
