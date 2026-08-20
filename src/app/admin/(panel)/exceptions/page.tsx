import { PageHeader } from "@/components/admin/ui";
import { ExceptionManager } from "./ExceptionManager";
import { getAllExceptions } from "@/server/queries/settings";

export const dynamic = "force-dynamic";

export const metadata = { title: "Почивки и изключения" };

export default async function AdminExceptionsPage() {
  const exceptions = await getAllExceptions();

  return (
    <>
      <PageHeader
        title="Почивки и изключения"
        description="Единични дни, в които работите различно или изобщо не работите. Може и да спрете приема на поръчки за конкретна дата."
      />
      <ExceptionManager exceptions={exceptions} />
    </>
  );
}
