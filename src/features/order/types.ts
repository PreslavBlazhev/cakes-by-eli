import type { DessertTypeConfig } from "@/features/configurator/types";

export type OrderProductOption = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  categoryAccent: string;
  imagePath: string | null;
  portions: string | null;
  basePriceCents: number | null;
  availability: "ACTIVE" | "SEASONAL";
  isCustomizable: boolean;
  dessertTypeId: string | null;
  shippingAllowed: boolean;
  pickupAllowed: boolean;
};

export type OrderCategoryOption = {
  id: string;
  name: string;
  slug: string;
};

export type OrderFlowData = {
  products: OrderProductOption[];
  categories: OrderCategoryOption[];
  desserts: DessertTypeConfig[];
  /** Dates the owner has closed for orders, with the reason to show. */
  blockedDates: { date: string; reason: string }[];
  minDate: string;
  disclaimer: string;
  phone: string;
  businessName: string;
  econtEnabled: boolean;
  maxFiles: number;
  maxFileMb: number;
  initial: {
    mode: "catalog" | "custom" | null;
    productId: string | null;
    dessertTypeId: string | null;
  };
};
