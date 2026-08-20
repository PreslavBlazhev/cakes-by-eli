import { PageHeader } from "@/components/admin/ui";
import { HoursForm } from "./HoursForm";
import { getWorkingHours } from "@/server/queries/settings";

export const dynamic = "force-dynamic";

export const metadata = { title: "Работно време" };

export default async function AdminHoursPage() {
  const hours = await getWorkingHours();

  return (
    <>
      <PageHeader
        title="Работно време"
        description="Показва се на страница „Контакти“ и във футъра. За единични дни използвайте „Почивки“."
      />
      <HoursForm hours={hours} />
    </>
  );
}
