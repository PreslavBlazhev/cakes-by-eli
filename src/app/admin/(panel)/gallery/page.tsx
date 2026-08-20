import { PageHeader } from "@/components/admin/ui";
import { GalleryManager } from "./GalleryManager";
import { listAllCategories } from "@/server/queries/catalog";
import { listAdminGallery } from "@/server/queries/gallery";

export const dynamic = "force-dynamic";

export const metadata = { title: "Галерия" };

export default async function AdminGalleryPage() {
  const [items, categories] = await Promise.all([
    listAdminGallery(),
    listAllCategories(),
  ]);

  return (
    <>
      <PageHeader
        title="Галерия"
        description="Снимките се появяват в сайта веднага след качване."
      />
      <GalleryManager
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        items={items.map((item) => ({
          id: item.id,
          path: item.path,
          caption: item.caption,
          categoryId: item.categoryId,
          sortOrder: item.sortOrder,
          isFeatured: item.isFeatured,
          isDemo: item.isDemo,
          archived: item.archivedAt !== null,
        }))}
      />
    </>
  );
}
