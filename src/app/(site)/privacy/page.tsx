import type { Metadata } from "next";

import { Container, Eyebrow, Section } from "@/components/ui/primitives";
import { getSettings } from "@/server/queries/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Политика за поверителност",
  description:
    "Как Cakes by ELI обработва личните данни, изпратени чрез формата за поръчка.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

export default async function PrivacyPage() {
  const settings = await getSettings();

  return (
    <>
      <section className="pb-4 pt-14 lg:pt-20">
        <Container>
          <Eyebrow>Поверителност</Eyebrow>
          <h1 className="display-1 mt-4">
            Политика за
            <br />
            поверителност.
          </h1>
        </Container>
      </section>

      <Section tone="cream" className="pt-8">
        <Container>
          <div className="panel max-w-[820px] p-8 sm:p-11">
            <p className="rounded-[var(--radius-sm)] border border-warning/30 bg-warning-soft px-4 py-3 text-[0.86rem] text-warning">
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
                <p className="mt-3">
                  Не използваме проследяващи или рекламни бисквитки. Сайтът
                  задава единствено технически необходима бисквитка за вход в
                  административния панел, която е достъпна само за собственика.
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
