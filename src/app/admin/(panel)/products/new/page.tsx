import { PageHeader } from "@/components/admin/ui";
import { ProductForm } from "../ProductForm";
import { listAllCategories, listDessertTypes } from "@/server/queries/catalog";
import { listImageLibrary } from "@/server/queries/gallery";

export const dynamic = "force-dynamic";

export const metadata = { title: "Нов продукт" };

export default async function NewProductPage() {
  const [categories, dessertTypes, imageLibrary] = await Promise.all([
    listAllCategories(),
    listDessertTypes(false),
    listImageLibrary(),
  ]);

  return (
    <>
      <PageHeader
        breadcrumb={{ href: "/admin/products", label: "Всички продукти" }}
        title="Нов продукт"
        description="Попълнете каквото знаете — можете да го допълните и по-късно."
      />

      <ProductForm
        images={[]}
        imageLibrary={imageLibrary}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        dessertTypes={dessertTypes.map((d) => ({ id: d.id, name: d.name }))}
        values={{
          categoryId: categories[0]?.id ?? "",
          dessertTypeId: "",
          name: "",
          slug: "",
          shortDescription: "",
          description: "",
          price: "",
          portions: "",
          weightGrams: "",
          availability: "ACTIVE",
          isFeatured: false,
          isCustomizable: false,
          ingredients: "",
          allergens: [],
          allergenNote: "",
          shippingAllowed: false,
          pickupAllowed: true,
          shipWeightKg: "",
          shipLengthCm: "",
          shipWidthCm: "",
          shipHeightCm: "",
          packageCount: "1",
          sortOrder: "0",
        }}
      />
    </>
  );
}
