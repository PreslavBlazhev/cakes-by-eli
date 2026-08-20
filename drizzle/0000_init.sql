CREATE TYPE "public"."product_availability" AS ENUM('ACTIVE', 'UNAVAILABLE', 'SEASONAL', 'HIDDEN');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('SENT', 'FAILED', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."fulfillment_method" AS ENUM('PICKUP', 'ECONT_OFFICE', 'ECONT_ADDRESS');--> statement-breakpoint
CREATE TYPE "public"."customization_input_type" AS ENUM('SINGLE', 'MULTI', 'TEXT', 'NUMBER');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('NEW', 'REVIEWING', 'AWAITING_CUSTOMER', 'CONFIRMED', 'IN_PRODUCTION', 'READY', 'SHIPPED', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."order_type" AS ENUM('CATALOG', 'CUSTOM');--> statement-breakpoint
CREATE TYPE "public"."preferred_contact" AS ENUM('PHONE', 'EMAIL', 'VIBER');--> statement-breakpoint
CREATE TYPE "public"."rule_mode" AS ENUM('SHOW_WHEN', 'HIDE_WHEN');--> statement-breakpoint
CREATE TYPE "public"."rule_target" AS ENUM('GROUP', 'OPTION');--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text DEFAULT 'Администратор' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text" text NOT NULL,
	"link_url" text,
	"link_label" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"image_path" text,
	"accent" text DEFAULT 'rose' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customization_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dessert_type_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"help_text" text DEFAULT '' NOT NULL,
	"input_type" "customization_input_type" DEFAULT 'SINGLE' NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"min_select" integer DEFAULT 0 NOT NULL,
	"max_select" integer DEFAULT 1 NOT NULL,
	"max_length" integer,
	"placeholder" text DEFAULT '' NOT NULL,
	"preview_channel" text DEFAULT '' NOT NULL,
	"step" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customization_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price_modifier_cents" integer,
	"preview_value" text DEFAULT '' NOT NULL,
	"swatch_color" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customization_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dessert_type_id" uuid NOT NULL,
	"target_type" "rule_target" NOT NULL,
	"target_key" text NOT NULL,
	"target_group_key" text,
	"mode" "rule_mode" DEFAULT 'SHOW_WHEN' NOT NULL,
	"when_group_key" text NOT NULL,
	"when_option_keys" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dessert_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"renderer" text DEFAULT 'generic' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"base_price_cents" integer,
	"category_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "econt_shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"shipment_number" text NOT NULL,
	"pdf_url" text,
	"total_price_cents" integer,
	"currency" text,
	"expected_delivery_date" timestamp with time zone,
	"environment" text NOT NULL,
	"tracking_status" text,
	"tracking_updated_at" timestamp with time zone,
	"request_payload" jsonb,
	"response_payload" jsonb,
	"voided_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gallery_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path" text NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"category_id" uuid,
	"width" integer,
	"height" integer,
	"is_featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"bucket" text NOT NULL,
	"succeeded" boolean DEFAULT false NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"path" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_counters" (
	"year" integer PRIMARY KEY NOT NULL,
	"last_seq" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"to_address" text NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"status" "email_status" NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"body" text NOT NULL,
	"author_id" uuid,
	"author_name" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"from_status" "order_status",
	"to_status" "order_status" NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"actor" text DEFAULT 'система' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"year" integer NOT NULL,
	"seq" integer NOT NULL,
	"order_type" "order_type" NOT NULL,
	"status" "order_status" DEFAULT 'NEW' NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"customer_phone_e164" text NOT NULL,
	"customer_email" text NOT NULL,
	"preferred_contact" "preferred_contact" DEFAULT 'PHONE' NOT NULL,
	"fulfillment_date" date,
	"occasion" text DEFAULT '' NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"fulfillment_method" "fulfillment_method" DEFAULT 'PICKUP' NOT NULL,
	"product_id" uuid,
	"dessert_type_id" uuid,
	"snapshot" jsonb NOT NULL,
	"config_state" jsonb,
	"estimated_price_cents" integer,
	"price_is_estimate" boolean DEFAULT true NOT NULL,
	"ship_recipient_name" text,
	"ship_recipient_phone" text,
	"ship_city_id" integer,
	"ship_city_name" text,
	"ship_post_code" text,
	"ship_quarter" text,
	"ship_street" text,
	"ship_street_num" text,
	"ship_other" text,
	"ship_office_code" text,
	"ship_office_name" text,
	"shipping_weight_kg" numeric(6, 2),
	"shipping_length_cm" integer,
	"shipping_width_cm" integer,
	"shipping_height_cm" integer,
	"shipping_description" text,
	"package_count" integer DEFAULT 1 NOT NULL,
	"qr_token" text NOT NULL,
	"qr_token_created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consent_accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"path" text NOT NULL,
	"alt" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"category_id" uuid NOT NULL,
	"dessert_type_id" uuid,
	"name" text NOT NULL,
	"short_description" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"base_price_cents" integer,
	"portions" text,
	"weight_grams" integer,
	"availability" "product_availability" DEFAULT 'ACTIVE' NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_customizable" boolean DEFAULT false NOT NULL,
	"ingredients" text DEFAULT '' NOT NULL,
	"allergens" text[] DEFAULT '{}'::text[] NOT NULL,
	"allergen_note" text DEFAULT '' NOT NULL,
	"shipping_allowed" boolean DEFAULT false NOT NULL,
	"pickup_allowed" boolean DEFAULT true NOT NULL,
	"ship_weight_kg" numeric(6, 2),
	"ship_length_cm" integer,
	"ship_width_cm" integer,
	"ship_height_cm" integer,
	"package_count" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"is_closed" boolean DEFAULT true NOT NULL,
	"opens_at" time,
	"closes_at" time,
	"blocks_orders" boolean DEFAULT false NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"business_name" text DEFAULT 'Cakes by ELI' NOT NULL,
	"tagline" text DEFAULT 'handcrafted sweets' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"address_line" text DEFAULT '' NOT NULL,
	"city" text DEFAULT 'Плевен' NOT NULL,
	"maps_url" text DEFAULT '' NOT NULL,
	"facebook_url" text DEFAULT '' NOT NULL,
	"instagram_url" text DEFAULT '' NOT NULL,
	"topbar_text" text DEFAULT '' NOT NULL,
	"hero_eyebrow" text DEFAULT '' NOT NULL,
	"hero_title" text DEFAULT '' NOT NULL,
	"hero_title_accent" text DEFAULT '' NOT NULL,
	"hero_subtitle" text DEFAULT '' NOT NULL,
	"about_eyebrow" text DEFAULT '' NOT NULL,
	"about_title" text DEFAULT '' NOT NULL,
	"about_text" text DEFAULT '' NOT NULL,
	"about_quote" text DEFAULT '' NOT NULL,
	"contact_intro" text DEFAULT '' NOT NULL,
	"order_disclaimer" text DEFAULT '' NOT NULL,
	"meta_description" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "working_hours" (
	"weekday" integer PRIMARY KEY NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"opens_at" time,
	"closes_at" time
);
--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_id_admin_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customization_groups" ADD CONSTRAINT "customization_groups_dessert_type_id_dessert_types_id_fk" FOREIGN KEY ("dessert_type_id") REFERENCES "public"."dessert_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customization_options" ADD CONSTRAINT "customization_options_group_id_customization_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."customization_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customization_rules" ADD CONSTRAINT "customization_rules_dessert_type_id_dessert_types_id_fk" FOREIGN KEY ("dessert_type_id") REFERENCES "public"."dessert_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dessert_types" ADD CONSTRAINT "dessert_types_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "econt_shipments" ADD CONSTRAINT "econt_shipments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "econt_shipments" ADD CONSTRAINT "econt_shipments_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_items" ADD CONSTRAINT "gallery_items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_attachments" ADD CONSTRAINT "order_attachments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_emails" ADD CONSTRAINT "order_emails_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_notes" ADD CONSTRAINT "order_notes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_notes" ADD CONSTRAINT "order_notes_author_id_admin_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_dessert_type_id_dessert_types_id_fk" FOREIGN KEY ("dessert_type_id") REFERENCES "public"."dessert_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_dessert_type_id_dessert_types_id_fk" FOREIGN KEY ("dessert_type_id") REFERENCES "public"."dessert_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_sessions_token_key" ON "admin_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "admin_sessions_admin_idx" ON "admin_sessions" USING btree ("admin_id");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "announcements_active_idx" ON "announcements" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_key" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "customization_groups_type_key" ON "customization_groups" USING btree ("dessert_type_id","key");--> statement-breakpoint
CREATE INDEX "customization_groups_type_idx" ON "customization_groups" USING btree ("dessert_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customization_options_group_key" ON "customization_options" USING btree ("group_id","key");--> statement-breakpoint
CREATE INDEX "customization_options_group_idx" ON "customization_options" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "customization_rules_type_idx" ON "customization_rules" USING btree ("dessert_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dessert_types_slug_key" ON "dessert_types" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "econt_shipments_order_idx" ON "econt_shipments" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "econt_shipments_number_key" ON "econt_shipments" USING btree ("shipment_number");--> statement-breakpoint
CREATE INDEX "gallery_items_sort_idx" ON "gallery_items" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "login_attempts_bucket_idx" ON "login_attempts" USING btree ("bucket","attempted_at");--> statement-breakpoint
CREATE INDEX "order_attachments_order_idx" ON "order_attachments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_emails_order_idx" ON "order_emails" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_notes_order_idx" ON "order_notes" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_status_history_order_idx" ON "order_status_history" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_number_key" ON "orders" USING btree ("order_number");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_qr_token_key" ON "orders" USING btree ("qr_token");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_created_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "orders_fulfillment_idx" ON "orders" USING btree ("fulfillment_date");--> statement-breakpoint
CREATE INDEX "product_images_product_idx" ON "product_images" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_slug_key" ON "products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "products_featured_idx" ON "products" USING btree ("is_featured");--> statement-breakpoint
CREATE UNIQUE INDEX "schedule_exceptions_date_key" ON "schedule_exceptions" USING btree ("date");