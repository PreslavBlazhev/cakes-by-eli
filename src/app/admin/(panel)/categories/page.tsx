import { Card, PageHeader } from "@/components/admin/ui";
import { CategoryManager } from "./CategoryManager";
import { listAllCategories, listAdminProducts } from "@/server/queries/catalog";

export const dynamic = "force-dynamic";

export const metadata = { title: "Категории" };

export default async function AdminCategoriesPage() {
  const [categories, products] = await Promise.all([
    listAllCategories(),
    listAdminProducts(),
  ]);

  const counts = new Map<string, number>();
  for (const product of products) {
    counts.set(product.categoryId, (counts.get(product.categoryId) ?? 0) + 1);
  }

  return (
    <>
      <PageHeader
        title="Категории"
        description="Категориите определят как е подредено менюто в сайта."
      />

      <Card padded={false}>
        <CategoryManager
          categories={categories.map((category) => ({
            id: category.id,
            name: category.name,
            slug: category.slug,
            description: category.description,
            accent: category.accent,
            sortOrder: category.sortOrder,
            isVisible: category.isVisible,
            imagePath: category.imagePath,
            productCount: counts.get(category.id) ?? 0,
          }))}
        />
      </Card>
    </>
  );
}
