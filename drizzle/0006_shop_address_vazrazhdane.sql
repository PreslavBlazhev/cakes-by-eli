-- Cakes by ELI shop address is пл. „Възраждане“ 1 again (28.11.2026), reverting
-- 0005. Only rows still holding the 0005 values are touched, so an address the
-- owner edited in the admin panel is left alone.
UPDATE "site_settings" SET "address_line" = 'пл. „Възраждане“ 1', "updated_at" = now() WHERE "address_line" = 'ул. „К. Величков“ 8';--> statement-breakpoint
UPDATE "site_settings" SET "maps_url" = 'https://maps.app.goo.gl/Qd1FjDnqqx7nTuVq6', "updated_at" = now() WHERE "maps_url" = 'https://www.google.com/maps/search/?api=1&query=%D1%83%D0%BB.%20%D0%9A.%20%D0%92%D0%B5%D0%BB%D0%B8%D1%87%D0%BA%D0%BE%D0%B2%208%2C%20%D0%9F%D0%BB%D0%B5%D0%B2%D0%B5%D0%BD';
