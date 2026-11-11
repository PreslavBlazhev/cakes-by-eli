import type { Metadata } from "next";

import { PageHeader } from "@/components/site/PageHeader";
import { Container, Section } from "@/components/ui/primitives";
import { getSettings } from "@/server/queries/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Политика за поверителност",
  description:
    "Как Cakes by ELI обработва личните данни, изпратени чрез формата за поръчка, и какви бисквитки използва сайтът.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

export default async function PrivacyPage() {
  const settings = await getSettings();

  return (
    <>
      <PageHeader
        crumbs={[
          { href: "/", label: "Начало" },
          { href: "/privacy", label: "Поверителност" },
        ]}
        label="Правна информация"
        title={
          <>
            Политика за
            <br />
            <em className="display-italic">поверителност.</em>
          </>
        }
      />

      <Section tone="cream" size="sm" className="pt-0">
        <Container>
          <div className="max-w-[68ch] border-t border-line pt-10">
            <p className="border-l-2 border-warning bg-warning-soft px-5 py-4 text-[0.86rem] leading-relaxed text-warning">
              <strong>Бележка към собственика:</strong> текстът по-долу описва
              коректно какви данни събира сайтът, но полетата за юридическо лице
              (наименование, ЕИК, адрес на управление, имейл за връзка) трябва да
              бъдат попълнени с реалните данни, преди сайтът да излезе онлайн.
              Този документ не е правен съвет.
            </p>

            <div className="mt-8 space-y-8 text-[0.97rem] leading-relaxed text-ink-soft [&_h2]:text-ink [&_li]:text-ink-soft">
              <section>
                <h2 className="display-3">1. Кой обработва данните ви</h2>
                <p className="mt-3">
                  Администратор на личните данни е{" "}
                  <strong className="text-ink">
                    {settings.businessName}
                  </strong>
                  {settings.addressLine
                    ? `, ${settings.addressLine}, ${settings.city}`
                    : ""}
                  .
                </p>
                <p className="mt-2">
                  Данни за контакт:{" "}
                  {settings.phone ? (
                    <span className="text-ink">{settings.phone}</span>
                  ) : (
                    <em>[телефон за контакт]</em>
                  )}
                  {settings.email ? (
                    <>
                      {" "}
                      · <span className="text-ink">{settings.email}</span>
                    </>
                  ) : (
                    <>
                      {" "}
                      · <em>[имейл за контакт]</em>
                    </>
                  )}
                </p>
                <p className="mt-2">
                  Юридическо лице и ЕИК: <em>[да бъдат попълнени]</em>
                </p>
              </section>

              <section>
                <h2 className="display-3">2. Какви данни събираме</h2>
                <p className="mt-3">
                  Обработваме само данните, които сами въвеждате във формата за
                  поръчка:
                </p>
                <ul className="mt-3 list-disc space-y-1.5 pl-5">
                  <li>име;</li>
                  <li>телефон;</li>
                  <li>имейл адрес;</li>
                  <li>
                    предпочитан начин за връзка, желана дата и повод на поръчката;
                  </li>
                  <li>
                    описание на десерта и избраните опции от конфигуратора;
                  </li>
                  <li>
                    данни за доставка (име на получател, телефон, населено място,
                    адрес или офис на Еконт) — само ако изберете доставка;
                  </li>
                  <li>
                    снимки, които доброволно прикачите като идея за вдъхновение.
                  </li>
                </ul>
              </section>

              <section id="cookies" className="scroll-mt-32">
                <h2 className="display-3">Бисквитки и статистика</h2>
                <p className="mt-3">
                  Не използваме рекламни бисквитки. Технически необходими са
                  бисквитката, която помни избора ви за бисквитки
                  (<code>cbe_cookie_consent</code>, 180 дни), и бисквитката за
                  вход в административния панел, достъпна само за собственика.
                </p>
                <p className="mt-2">
                  Само ако натиснете „Приемам“ в банера, сайтът зарежда Google
                  Tag Manager и Google Analytics (Google Ireland Ltd.), които
                  задават бисквитки <code>_ga</code> и <code>_ga_*</code> (до 2
                  години) и събират обобщена статистика: посетени страници,
                  кликове върху телефон, имейл и социални мрежи и факта, че е
                  изпратена поръчка. Не изпращаме към Google имена, телефони,
                  имейли или съдържание от формата за поръчка. Основание е
                  вашето съгласие, което можете да оттеглите по всяко време
                  чрез „Настройки за бисквитки“ в долната част на всяка
                  страница.
                </p>
              </section>

              <section>
                <h2 className="display-3">3. Защо ги обработваме</h2>
                <ul className="mt-3 list-disc space-y-1.5 pl-5">
                  <li>
                    за да отговорим на вашето запитване и да потвърдим поръчката
                    (изпълнение на договор или стъпки преди сключването му);
                  </li>
                  <li>
                    за да организираме изработката и предаването на десерта;
                  </li>
                  <li>
                    за да подготвим товарителница чрез Еконт, ако сте избрали
                    доставка;
                  </li>
                  <li>
                    за да спазим счетоводни и данъчни задължения, когато е
                    приложимо.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="display-3">4. На кого ги предаваме</h2>
                <p className="mt-3">
                  Данните ви не се продават и не се предоставят за маркетингови
                  цели. Предаваме ги само когато е необходимо:
                </p>
                <ul className="mt-3 list-disc space-y-1.5 pl-5">
                  <li>
                    на „Еконт Експрес“ ООД — име, телефон и адрес за доставка,
                    единствено ако сте избрали доставка с куриер;
                  </li>
                  <li>
                    на доставчика, който хоства сайта и изпраща имейлите за
                    потвърждение.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="display-3">5. Колко дълго ги пазим</h2>
                <p className="mt-3">
                  Поръчките и приложените към тях снимки се пазят толкова, колкото
                  е необходимо за изпълнението им и за евентуални последващи
                  въпроси, а след това се изтриват или архивират. Данни, за които
                  има законово задължение за съхранение, се пазят за съответния
                  срок.
                </p>
              </section>

              <section>
                <h2 className="display-3">6. Вашите права</h2>
                <p className="mt-3">
                  Имате право на достъп, коригиране, изтриване, ограничаване на
                  обработването, преносимост и възражение. Може да упражните
                  правата си, като се свържете с нас на посочените по-горе
                  контакти.
                </p>
                <p className="mt-2">
                  Ако смятате, че правата ви са нарушени, можете да подадете
                  жалба до Комисията за защита на личните данни.
                </p>
              </section>

              <section>
                <h2 className="display-3">7. Сигурност</h2>
                <p className="mt-3">
                  Достъпът до поръчките е защитен с индивидуален акаунт и
                  криптирана парола. Прикачените снимки са достъпни само през
                  административния панел. Комуникацията със сайта е защитена с
                  HTTPS.
                </p>
              </section>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
