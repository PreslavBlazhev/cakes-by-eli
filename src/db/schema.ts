import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

/* ------------------------------------------------------------------ *
 * Enums
 * ------------------------------------------------------------------ */

export const orderTypeEnum = pgEnum("order_type", ["CATALOG", "CUSTOM"]);

export const orderStatusEnum = pgEnum("order_status", [
  "NEW",
  "REVIEWING",
  "AWAITING_CUSTOMER",
  "CONFIRMED",
  "IN_PRODUCTION",
  "READY",
  "SHIPPED",
  "COMPLETED",
  "CANCELLED",
]);

export const fulfillmentMethodEnum = pgEnum("fulfillment_method", [
  "PICKUP",
  "ECONT_OFFICE",
  "ECONT_ADDRESS",
]);

export const preferredContactEnum = pgEnum("preferred_contact", [
  "PHONE",
  "EMAIL",
  "VIBER",
]);

export const availabilityEnum = pgEnum("product_availability", [
  "ACTIVE",
  "UNAVAILABLE",
  "SEASONAL",
  "HIDDEN",
]);

export const inputTypeEnum = pgEnum("customization_input_type", [
  "SINGLE",
  "MULTI",
  "TEXT",
  "NUMBER",
]);

export const ruleTargetEnum = pgEnum("rule_target", ["GROUP", "OPTION"]);
export const ruleModeEnum = pgEnum("rule_mode", ["SHOW_WHEN", "HIDE_WHEN"]);

export const emailStatusEnum = pgEnum("email_status", [
  "SENT",
  "FAILED",
  "SKIPPED",
]);

/* ------------------------------------------------------------------ *
 * Admin and authentication
 * ------------------------------------------------------------------ */

/**
 * The admin account. It carries no password: the credentials are the plain
 * ADMIN_EMAIL and ADMIN_PASSWORD from the environment. The row exists because
 * sessions, order notes and audit entries all point at an admin id, and it is
 * created on the first successful login.
 */
export const adminUsers = pgTable(
  "admin_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull().default("Администратор"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("admin_users_email_key").on(sql`lower(${t.email})`)],
);

/**
 * Server-side session records. The cookie only carries a random token whose
 * SHA-256 digest is stored here, so sessions stay revocable and a database
 * leak does not hand out usable cookies.
 */
export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    userAgent: text("user_agent"),
  },
  (t) => [
    uniqueIndex("admin_sessions_token_key").on(t.tokenHash),
    index("admin_sessions_admin_idx").on(t.adminId),
  ],
);

/** Sliding-window records used to throttle admin login attempts. */
export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: serial("id").primaryKey(),
    bucket: text("bucket").notNull(),
    succeeded: boolean("succeeded").notNull().default(false),
    attemptedAt: timestamp("attempted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("login_attempts_bucket_idx").on(t.bucket, t.attemptedAt)],
);

/* ------------------------------------------------------------------ *
 * Site settings and schedule
 * ------------------------------------------------------------------ */

export const siteSettings = pgTable("site_settings", {
  id: integer("id").primaryKey().default(1),

  businessName: text("business_name").notNull().default("Cakes by ELI"),
  tagline: text("tagline").notNull().default("handcrafted sweets"),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  addressLine: text("address_line").notNull().default(""),
  city: text("city").notNull().default("Плевен"),
  mapsUrl: text("maps_url").notNull().default(""),
  facebookUrl: text("facebook_url").notNull().default(""),
  instagramUrl: text("instagram_url").notNull().default(""),

  topbarText: text("topbar_text").notNull().default(""),
  heroEyebrow: text("hero_eyebrow").notNull().default(""),
  heroTitle: text("hero_title").notNull().default(""),
  heroTitleAccent: text("hero_title_accent").notNull().default(""),
  heroSubtitle: text("hero_subtitle").notNull().default(""),

  aboutEyebrow: text("about_eyebrow").notNull().default(""),
  aboutTitle: text("about_title").notNull().default(""),
  aboutText: text("about_text").notNull().default(""),
  aboutQuote: text("about_quote").notNull().default(""),

  contactIntro: text("contact_intro").notNull().default(""),
  orderDisclaimer: text("order_disclaimer").notNull().default(""),
  metaDescription: text("meta_description").notNull().default(""),

  /** Remaining home-page copy, keyed as in `src/lib/home-content.ts`. */
  homeContent: jsonb("home_content")
    .$type<Record<string, string>>()
    .notNull()
    .default({}),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export const workingHours = pgTable("working_hours", {
  weekday: integer("weekday").primaryKey(),
  isClosed: boolean("is_closed").notNull().default(false),
  opensAt: time("opens_at"),
  closesAt: time("closes_at"),
});

/**
 * One model covers both "different hours that day" and "we do not take orders
 * for that day", which keeps the owner-facing screen to a single concept.
 */
export const scheduleExceptions = pgTable(
  "schedule_exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    date: date("date").notNull(),
    isClosed: boolean("is_closed").notNull().default(true),
    opensAt: time("opens_at"),
    closesAt: time("closes_at"),
    blocksOrders: boolean("blocks_orders").notNull().default(false),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("schedule_exceptions_date_key").on(t.date)],
);

export const announcements = pgTable(
  "announcements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    text: text("text").notNull(),
    linkUrl: text("link_url"),
    linkLabel: text("link_label"),
    isActive: boolean("is_active").notNull().default(true),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("announcements_active_idx").on(t.isActive)],
);

/* ------------------------------------------------------------------ *
 * Catalog
 * ------------------------------------------------------------------ */

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    imagePath: text("image_path"),
    accent: text("accent").notNull().default("rose"),
    sortOrder: integer("sort_order").notNull().default(0),
    isVisible: boolean("is_visible").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("categories_slug_key").on(t.slug)],
);

export const dessertTypes = pgTable(
  "dessert_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    /** Which SVG preview component drives the live visualiser. */
    renderer: text("renderer").notNull().default("generic"),
    description: text("description").notNull().default(""),
    basePriceCents: integer("base_price_cents"),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("dessert_types_slug_key").on(t.slug)],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    dessertTypeId: uuid("dessert_type_id").references(() => dessertTypes.id, {
      onDelete: "set null",
    }),

    name: text("name").notNull(),
    shortDescription: text("short_description").notNull().default(""),
    description: text("description").notNull().default(""),

    basePriceCents: integer("base_price_cents"),
    portions: text("portions"),
    weightGrams: integer("weight_grams"),

    availability: availabilityEnum("availability").notNull().default("ACTIVE"),
    isFeatured: boolean("is_featured").notNull().default(false),
    isCustomizable: boolean("is_customizable").notNull().default(false),

    ingredients: text("ingredients").notNull().default(""),
    allergens: text("allergens")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    allergenNote: text("allergen_note").notNull().default(""),

    shippingAllowed: boolean("shipping_allowed").notNull().default(false),
    pickupAllowed: boolean("pickup_allowed").notNull().default(true),
    shipWeightKg: numeric("ship_weight_kg", { precision: 6, scale: 2 }),
    shipLengthCm: integer("ship_length_cm"),
    shipWidthCm: integer("ship_width_cm"),
    shipHeightCm: integer("ship_height_cm"),
    packageCount: integer("package_count").notNull().default(1),

    sortOrder: integer("sort_order").notNull().default(0),
    isDemo: boolean("is_demo").notNull().default(false),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("products_slug_key").on(t.slug),
    index("products_category_idx").on(t.categoryId),
    index("products_featured_idx").on(t.isFeatured),
  ],
);

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    alt: text("alt").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("product_images_product_idx").on(t.productId)],
);

/* ------------------------------------------------------------------ *
 * Configurator
 * ------------------------------------------------------------------ */

export const customizationGroups = pgTable(
  "customization_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dessertTypeId: uuid("dessert_type_id")
      .notNull()
      .references(() => dessertTypes.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    helpText: text("help_text").notNull().default(""),
    inputType: inputTypeEnum("input_type").notNull().default("SINGLE"),
    isRequired: boolean("is_required").notNull().default(false),
    minSelect: integer("min_select").notNull().default(0),
    maxSelect: integer("max_select").notNull().default(1),
    maxLength: integer("max_length"),
    placeholder: text("placeholder").notNull().default(""),
    /** Which layer of the SVG visualiser this group feeds. */
    previewChannel: text("preview_channel").notNull().default(""),
    /** Wizard step this group belongs to (1-based). */
    step: integer("step").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("customization_groups_type_key").on(t.dessertTypeId, t.key),
    index("customization_groups_type_idx").on(t.dessertTypeId),
  ],
);

export const customizationOptions = pgTable(
  "customization_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => customizationGroups.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    description: text("description").notNull().default(""),
    priceModifierCents: integer("price_modifier_cents"),
    /** Token understood by the preview renderer, e.g. "heart" or "#f3e7d8". */
    previewValue: text("preview_value").notNull().default(""),
    swatchColor: text("swatch_color"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("customization_options_group_key").on(t.groupId, t.key),
    index("customization_options_group_idx").on(t.groupId),
  ],
);

/**
 * Declarative visibility rules. A target renders when every SHOW_WHEN rule
 * matches and no HIDE_WHEN rule matches — evaluated by the same pure function
 * on the client (for the UI) and on the server (for validation).
 */
export const customizationRules = pgTable(
  "customization_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dessertTypeId: uuid("dessert_type_id")
      .notNull()
      .references(() => dessertTypes.id, { onDelete: "cascade" }),
    targetType: ruleTargetEnum("target_type").notNull(),
    targetKey: text("target_key").notNull(),
    /** For OPTION targets — the group the option lives in. */
    targetGroupKey: text("target_group_key"),
    mode: ruleModeEnum("mode").notNull().default("SHOW_WHEN"),
    whenGroupKey: text("when_group_key").notNull(),
    whenOptionKeys: text("when_option_keys")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("customization_rules_type_idx").on(t.dessertTypeId)],
);

/* ------------------------------------------------------------------ *
 * Gallery
 * ------------------------------------------------------------------ */

export const galleryItems = pgTable(
  "gallery_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    path: text("path").notNull(),
    caption: text("caption").notNull().default(""),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    width: integer("width"),
    height: integer("height"),
    isFeatured: boolean("is_featured").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    isDemo: boolean("is_demo").notNull().default(false),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("gallery_items_sort_idx").on(t.sortOrder)],
);

/* ------------------------------------------------------------------ *
 * Orders
 * ------------------------------------------------------------------ */

/** Per-year sequence backing the human readable CBE-YYYY-NNNNN number. */
export const orderCounters = pgTable("order_counters", {
  year: integer("year").primaryKey(),
  lastSeq: integer("last_seq").notNull().default(0),
});

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderNumber: text("order_number").notNull(),
    year: integer("year").notNull(),
    seq: integer("seq").notNull(),

    orderType: orderTypeEnum("order_type").notNull(),
    status: orderStatusEnum("status").notNull().default("NEW"),

    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    customerPhoneE164: text("customer_phone_e164").notNull(),
    customerEmail: text("customer_email").notNull(),
    preferredContact: preferredContactEnum("preferred_contact")
      .notNull()
      .default("PHONE"),

    fulfillmentDate: date("fulfillment_date"),
    occasion: text("occasion").notNull().default(""),
    quantity: integer("quantity").notNull().default(1),
    notes: text("notes").notNull().default(""),

    fulfillmentMethod: fulfillmentMethodEnum("fulfillment_method")
      .notNull()
      .default("PICKUP"),

    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    dessertTypeId: uuid("dessert_type_id").references(() => dessertTypes.id, {
      onDelete: "set null",
    }),

    /** Immutable, human-readable record of what was ordered. */
    snapshot: jsonb("snapshot").notNull(),
    /** Raw configurator state, replayed by the admin preview renderer. */
    configState: jsonb("config_state"),

    estimatedPriceCents: integer("estimated_price_cents"),
    priceIsEstimate: boolean("price_is_estimate").notNull().default(true),

    /* Shipping details, supplied by the customer and correctable by admin. */
    shipRecipientName: text("ship_recipient_name"),
    shipRecipientPhone: text("ship_recipient_phone"),
    shipCityId: integer("ship_city_id"),
    shipCityName: text("ship_city_name"),
    shipPostCode: text("ship_post_code"),
    shipQuarter: text("ship_quarter"),
    shipStreet: text("ship_street"),
    shipStreetNum: text("ship_street_num"),
    shipOther: text("ship_other"),
    shipOfficeCode: text("ship_office_code"),
    shipOfficeName: text("ship_office_name"),

    shippingWeightKg: numeric("shipping_weight_kg", { precision: 6, scale: 2 }),
    shippingLengthCm: integer("shipping_length_cm"),
    shippingWidthCm: integer("shipping_width_cm"),
    shippingHeightCm: integer("shipping_height_cm"),
    shippingDescription: text("shipping_description"),
    packageCount: integer("package_count").notNull().default(1),

    /** Unguessable token behind the internal operations QR code. */
    qrToken: text("qr_token").notNull(),
    qrTokenCreatedAt: timestamp("qr_token_created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    consentAcceptedAt: timestamp("consent_accepted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_number_key").on(t.orderNumber),
    uniqueIndex("orders_qr_token_key").on(t.qrToken),
    index("orders_status_idx").on(t.status),
    index("orders_created_idx").on(t.createdAt),
    index("orders_fulfillment_idx").on(t.fulfillmentDate),
  ],
);

export const orderAttachments = pgTable(
  "order_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("order_attachments_order_idx").on(t.orderId)],
);

export const orderStatusHistory = pgTable(
  "order_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    fromStatus: orderStatusEnum("from_status"),
    toStatus: orderStatusEnum("to_status").notNull(),
    note: text("note").notNull().default(""),
    actor: text("actor").notNull().default("система"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("order_status_history_order_idx").on(t.orderId)],
);

export const orderNotes = pgTable(
  "order_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    authorId: uuid("author_id").references(() => adminUsers.id, {
      onDelete: "set null",
    }),
    authorName: text("author_name").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("order_notes_order_idx").on(t.orderId)],
);

export const orderEmails = pgTable(
  "order_emails",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    toAddress: text("to_address").notNull(),
    subject: text("subject").notNull().default(""),
    status: emailStatusEnum("status").notNull(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("order_emails_order_idx").on(t.orderId)],
);

export const econtShipments = pgTable(
  "econt_shipments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    shipmentNumber: text("shipment_number").notNull(),
    pdfUrl: text("pdf_url"),
    totalPriceCents: integer("total_price_cents"),
    currency: text("currency"),
    expectedDeliveryDate: timestamp("expected_delivery_date", {
      withTimezone: true,
    }),
    environment: text("environment").notNull(),
    trackingStatus: text("tracking_status"),
    trackingUpdatedAt: timestamp("tracking_updated_at", { withTimezone: true }),
    requestPayload: jsonb("request_payload"),
    responsePayload: jsonb("response_payload"),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => adminUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("econt_shipments_order_idx").on(t.orderId),
    uniqueIndex("econt_shipments_number_key").on(t.shipmentNumber),
  ],
);

/* ------------------------------------------------------------------ *
 * Relations
 * ------------------------------------------------------------------ */

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
  dessertTypes: many(dessertTypes),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  dessertType: one(dessertTypes, {
    fields: [products.dessertTypeId],
    references: [dessertTypes.id],
  }),
  images: many(productImages),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
}));

export const dessertTypesRelations = relations(
  dessertTypes,
  ({ one, many }) => ({
    category: one(categories, {
      fields: [dessertTypes.categoryId],
      references: [categories.id],
    }),
    groups: many(customizationGroups),
    rules: many(customizationRules),
  }),
);

export const customizationGroupsRelations = relations(
  customizationGroups,
  ({ one, many }) => ({
    dessertType: one(dessertTypes, {
      fields: [customizationGroups.dessertTypeId],
      references: [dessertTypes.id],
    }),
    options: many(customizationOptions),
  }),
);

export const customizationOptionsRelations = relations(
  customizationOptions,
  ({ one }) => ({
    group: one(customizationGroups, {
      fields: [customizationOptions.groupId],
      references: [customizationGroups.id],
    }),
  }),
);

export const customizationRulesRelations = relations(
  customizationRules,
  ({ one }) => ({
    dessertType: one(dessertTypes, {
      fields: [customizationRules.dessertTypeId],
      references: [dessertTypes.id],
    }),
  }),
);

export const ordersRelations = relations(orders, ({ one, many }) => ({
  product: one(products, {
    fields: [orders.productId],
    references: [products.id],
  }),
  dessertType: one(dessertTypes, {
    fields: [orders.dessertTypeId],
    references: [dessertTypes.id],
  }),
  attachments: many(orderAttachments),
  history: many(orderStatusHistory),
  notes: many(orderNotes),
  emails: many(orderEmails),
  shipments: many(econtShipments),
}));

export const orderAttachmentsRelations = relations(
  orderAttachments,
  ({ one }) => ({
    order: one(orders, {
      fields: [orderAttachments.orderId],
      references: [orders.id],
    }),
  }),
);

export const orderStatusHistoryRelations = relations(
  orderStatusHistory,
  ({ one }) => ({
    order: one(orders, {
      fields: [orderStatusHistory.orderId],
      references: [orders.id],
    }),
  }),
);

export const orderNotesRelations = relations(orderNotes, ({ one }) => ({
  order: one(orders, {
    fields: [orderNotes.orderId],
    references: [orders.id],
  }),
}));

export const orderEmailsRelations = relations(orderEmails, ({ one }) => ({
  order: one(orders, {
    fields: [orderEmails.orderId],
    references: [orders.id],
  }),
}));

export const econtShipmentsRelations = relations(econtShipments, ({ one }) => ({
  order: one(orders, {
    fields: [econtShipments.orderId],
    references: [orders.id],
  }),
}));

export const adminUsersRelations = relations(adminUsers, ({ many }) => ({
  sessions: many(adminSessions),
}));

export const adminSessionsRelations = relations(adminSessions, ({ one }) => ({
  admin: one(adminUsers, {
    fields: [adminSessions.adminId],
    references: [adminUsers.id],
  }),
}));

export const galleryItemsRelations = relations(galleryItems, ({ one }) => ({
  category: one(categories, {
    fields: [galleryItems.categoryId],
    references: [categories.id],
  }),
}));
