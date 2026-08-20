"use client";

import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { Card } from "@/components/admin/ui";
import { Field, Input, Textarea } from "@/components/ui/form";
import { saveSiteSettings } from "@/server/admin/site";
import type { SiteSettings } from "@/server/queries/settings";

export function ContentForm({ settings }: { settings: SiteSettings }) {
  return (
    <ActionForm action={saveSiteSettings} className="space-y-4">
      {({ pending, fieldErrors }) => (
        <>
          <Card
            title="Данни за бизнеса"
            description="Използват се в хедъра, футъра, контактите и имейлите."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Име на бизнеса"
                required
                error={fieldErrors.businessName}
                htmlFor="s-name"
              >
                <Input
                  id="s-name"
                  name="businessName"
                  defaultValue={settings.businessName}
                  required
                  maxLength={80}
                />
              </Field>

              <Field label="Подзаглавие" htmlFor="s-tagline">
                <Input
                  id="s-tagline"
                  name="tagline"
                  defaultValue={settings.tagline}
                  maxLength={80}
                />
              </Field>

              <Field label="Телефон" htmlFor="s-phone">
                <Input
                  id="s-phone"
                  name="phone"
                  defaultValue={settings.phone}
                  maxLength={30}
                  placeholder="087 857 6728"
                />
              </Field>

              <Field
                label="Имейл за контакт"
                hint="Показва се публично в сайта."
                error={fieldErrors.email}
                htmlFor="s-email"
              >
                <Input
                  id="s-email"
                  name="email"
                  type="email"
                  defaultValue={settings.email}
                  maxLength={160}
                />
              </Field>

              <Field label="Адрес" htmlFor="s-address">
                <Input
                  id="s-address"
                  name="addressLine"
                  defaultValue={settings.addressLine}
                  maxLength={160}
                />
              </Field>

              <Field label="Град" htmlFor="s-city">
                <Input
                  id="s-city"
                  name="city"
                  defaultValue={settings.city}
                  maxLength={80}
                />
              </Field>

              <Field
                label="Google Maps връзка"
                hint="Пълен адрес, започващ с https://"
                htmlFor="s-maps"
              >
                <Input
                  id="s-maps"
                  name="mapsUrl"
                  defaultValue={settings.mapsUrl}
                  maxLength={500}
                />
              </Field>

              <Field label="Facebook" htmlFor="s-fb">
                <Input
                  id="s-fb"
                  name="facebookUrl"
                  defaultValue={settings.facebookUrl}
                  maxLength={500}
                />
              </Field>

              <Field label="Instagram" htmlFor="s-ig">
                <Input
                  id="s-ig"
                  name="instagramUrl"
                  defaultValue={settings.instagramUrl}
                  maxLength={500}
                />
              </Field>
            </div>
          </Card>

          <Card title="Начална страница">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Текст в най-горната лента"
                hint="Ако има активно съобщение, то замества този текст."
                htmlFor="s-topbar"
                className="sm:col-span-2"
              >
                <Input
                  id="s-topbar"
                  name="topbarText"
                  defaultValue={settings.topbarText}
                  maxLength={200}
                />
              </Field>

              <Field label="Надзаглавие" htmlFor="s-hero-eyebrow">
                <Input
                  id="s-hero-eyebrow"
                  name="heroEyebrow"
                  defaultValue={settings.heroEyebrow}
                  maxLength={80}
                />
              </Field>

              <Field label="Заглавие" htmlFor="s-hero-title">
                <Input
                  id="s-hero-title"
                  name="heroTitle"
                  defaultValue={settings.heroTitle}
                  maxLength={80}
                />
              </Field>

              <Field
                label="Акцент в заглавието"
                hint="Показва се на нов ред, в розово."
                htmlFor="s-hero-accent"
              >
                <Input
                  id="s-hero-accent"
                  name="heroTitleAccent"
                  defaultValue={settings.heroTitleAccent}
                  maxLength={80}
                />
              </Field>

              <Field
                label="Подзаглавие"
                htmlFor="s-hero-sub"
                className="sm:col-span-2"
              >
                <Textarea
                  id="s-hero-sub"
                  name="heroSubtitle"
                  defaultValue={settings.heroSubtitle}
                  maxLength={400}
                  className="min-h-24"
                />
              </Field>
            </div>
          </Card>

          <Card
            title="За Ели"
            description="Оставете празно, ако не искате секцията да се показва."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Надзаглавие" htmlFor="s-about-eyebrow">
                <Input
                  id="s-about-eyebrow"
                  name="aboutEyebrow"
                  defaultValue={settings.aboutEyebrow}
                  maxLength={80}
                />
              </Field>

              <Field
                label="Заглавие"
                hint="Ново заглавие на нов ред се пренася както е въведено."
                htmlFor="s-about-title"
              >
                <Input
                  id="s-about-title"
                  name="aboutTitle"
                  defaultValue={settings.aboutTitle}
                  maxLength={120}
                />
              </Field>

              <Field label="Текст" htmlFor="s-about-text" className="sm:col-span-2">
                <Textarea
                  id="s-about-text"
                  name="aboutText"
                  defaultValue={settings.aboutText}
                  maxLength={2000}
                  className="min-h-32"
                />
              </Field>

              <Field label="Цитат" htmlFor="s-about-quote" className="sm:col-span-2">
                <Input
                  id="s-about-quote"
                  name="aboutQuote"
                  defaultValue={settings.aboutQuote}
                  maxLength={300}
                />
              </Field>
            </div>
          </Card>

          <Card title="Контакти и поръчки">
            <div className="grid gap-4">
              <Field label="Уводен текст на страница „Контакти“" htmlFor="s-contact">
                <Textarea
                  id="s-contact"
                  name="contactIntro"
                  defaultValue={settings.contactIntro}
                  maxLength={400}
                  className="min-h-20"
                />
              </Field>

              <Field
                label="Текст при поръчка"
                hint="Показва се в обобщението и в потвърждаващия имейл."
                htmlFor="s-disclaimer"
              >
                <Textarea
                  id="s-disclaimer"
                  name="orderDisclaimer"
                  defaultValue={settings.orderDisclaimer}
                  maxLength={400}
                  className="min-h-20"
                />
              </Field>

              <Field
                label="Описание за търсачки (meta description)"
                hint="До 160 знака работят най-добре."
                htmlFor="s-meta"
              >
                <Textarea
                  id="s-meta"
                  name="metaDescription"
                  defaultValue={settings.metaDescription}
                  maxLength={300}
                  className="min-h-20"
                />
              </Field>
            </div>
          </Card>

          <div className="sticky bottom-0 -mx-4 flex justify-end border-t border-line bg-paper/95 px-4 py-3 backdrop-blur lg:-mx-6 lg:px-6">
            <SubmitButton pending={pending}>Запази</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
