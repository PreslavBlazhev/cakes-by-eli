import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { PageHeader } from "@/components/admin/ui";
import { ProductForm } from "../ProductForm";
import { Badge } from "@/components/ui/primitives";
import {
  getAdminProduct,
  listAllCategories,
  listDessertTypes,
} from "@/server/queries/catalog";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params) {
  const { id } = await params;
  const product = await getAdminProduct(id);
  return { title: product?.name ?? "Продукт" };
}

export default async function EditProductPage({ params }: Params) {
  const { id } = await params;

  const [product, categories, dessertTypes] = await Promise.all([
    getAdminProduct(id),
    listAllCategories(),
    listDessertTypes(false),
  ]);

  if (!product) notFound();

  return (
    <>
      <PageHeader
        breadcrumb={{ href: "/admin/products", label: "Всички продукти" }}
        title={product.name}
        description={`/menu/${product.category.slug}/${product.slug}`}
        actions={
          <>
            {product.isDemo ? <Badge tone="warning">Демо съдържание</Badge> : null}
            <Link
              href={`/menu/${product.category.slug}/${product.slug}`}
              target="_blank"
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line bg-paper px-4 text-[0.86rem] font-semibold transition-colors hover:border-ink"
            >
              <ExternalLink size={14} aria-hidden="true" />
              Виж в сайта
            </Link>
          </>
        }
      />

      <ProductForm
        images={product.images.map((image) => ({
          id: image.id,
          path: image.path,
          alt: image.alt,
        }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        dessertTypes={dessertTypes.map((d) => ({ id: d.id, name: d.name }))}
        values={{
          id: product.id,
          categoryId: product.categoryId,
          dessertTypeId: product.dessertTypeId ?? "",
          name: product.name,
          slug: product.slug,
          shortDescription: product.shortDescription,
          description: product.description,
          price:
            product.basePriceCents === null
              ? ""
              : (product.basePriceCents / 100).toFixed(2),
          portions: product.portions ?? "",
          weightGrams: product.weightGrams ? String(product.weightGrams) : "",
          availability: product.availability,
          isFeatured: product.isFeatured,
          isCustomizable: product.isCustomizable,
          ingredients: product.ingredients,
          allergens: product.allergens,
          allergenNote: product.allergenNote,
          shippingAllowed: product.shippingAllowed,
          pickupAllowed: product.pickupAllowed,
          shipWeightKg: product.shipWeightKg ?? "",
          shipLengthCm: product.shipLengthCm ? String(product.shipLengthCm) : "",
          shipWidthCm: product.shipWidthCm ? String(product.shipWidthCm) : "",
          shipHeightCm: product.shipHeightCm ? String(product.shipHeightCm) : "",
          packageCount: String(product.packageCount),
          sortOrder: String(product.sortOrder),
        }}
      />
    </>
  );
}
