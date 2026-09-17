/**
 * Every piece of home-page copy that is not already its own column on
 * `site_settings` (hero title, about section, …).
 *
 * These texts used to be written straight into `src/app/(site)/page.tsx`, so
 * the owner could change the hero but not the section below it and had no way
 * to tell which was which. They now live in one JSON column, described here
 * once: the admin form is generated from `HOME_SECTIONS`, the save action
 * validates against it, and the page reads through `resolveHomeContent`, so a
 * field cannot exist in one place and be missing from another.
 *
 * The defaults are the texts the site shipped with. A key that was never saved
 * falls back to its default; a key the owner cleared stays empty, and the page
 * hides whatever it would have shown.
 */

export type HomeFieldKind =
  /** One line. */
  | "line"
  /** Several lines; line breaks are kept where they are typed. */
  | "text"
  /** One item per line. */
  | "list";

export type HomeField = {
  key: string;
  label: string;
  hint?: string;
  kind: HomeFieldKind;
  max: number;
  default: string;
  /** Takes the full width of the two-column form grid. */
  wide?: boolean;
};

export type HomeSection = {
  id: string;
  title: string;
  description: string;
  fields: HomeField[];
};

const TITLE_HINT = "Нов ред в полето — нов ред на сайта.";
const ACCENT_HINT = "Показва се на нов ред, в курсив.";

export const HOME_SECTIONS = [
  {
    id: "hero-extra",
    title: "Горна част — бутони и три реда под тях",
    description:
      "Под заглавието на първия екран. Третият ред по подразбиране показва града и адреса.",
    fields: [
      { key: "heroPrimaryCta", label: "Основен бутон", kind: "line", max: 40, default: "Създай свой десерт" },
      { key: "heroSecondaryCta", label: "Втори бутон", kind: "line", max: 40, default: "Разгледай менюто" },
      { key: "credential1Title", label: "Ред 1 — заглавие", kind: "line", max: 40, default: "По поръчка" },
      { key: "credential1Text", label: "Ред 1 — текст", kind: "line", max: 60, default: "индивидуален дизайн" },
      { key: "credential2Title", label: "Ред 2 — заглавие", kind: "line", max: 40, default: "Ръчна изработка" },
      { key: "credential2Text", label: "Ред 2 — текст", kind: "line", max: 60, default: "внимание към детайла" },
      { key: "credential3Title", label: "Ред 3 — заглавие", hint: "Празно — показва града.", kind: "line", max: 40, default: "" },
      { key: "credential3Text", label: "Ред 3 — текст", hint: "Празно — показва адреса.", kind: "line", max: 60, default: "" },
    ],
  },
  {
    id: "marquee",
    title: "Движещата се лента",
    description: "Думите, които се движат под първия екран.",
    fields: [
      {
        key: "marqueeItems",
        label: "Думи",
        hint: "По една на ред.",
        kind: "list",
        max: 600,
        wide: true,
        default: [
          "Бутикови торти",
          "Еклери",
          "Макарони",
          "Къпкейкове",
          "Декорирани бисквити",
          "Сладки барове",
        ].join("\n"),
      },
    ],
  },
  {
    id: "featured",
    title: "Избрани продукти",
    description:
      "Секцията с продуктите, отбелязани като „избрани“. Показва се само ако има такива.",
    fields: [
      { key: "featuredEyebrow", label: "Надзаглавие", kind: "line", max: 60, default: "Избрано" },
      { key: "featuredLink", label: "Текст на връзката", kind: "line", max: 40, default: "Цялото меню" },
      { key: "featuredTitle", label: "Заглавие", hint: TITLE_HINT, kind: "text", max: 120, default: "Малки детайли." },
      { key: "featuredAccent", label: "Акцент в заглавието", hint: ACCENT_HINT, kind: "line", max: 80, default: "Големи поводи." },
      { key: "featuredIntro", label: "Текст", kind: "text", max: 400, wide: true, default: "Няколко от текущите предложения. Всяко може да бъде адаптирано към вашия повод — вкус, размер и декорация се уточняват заедно." },
    ],
  },
  {
    id: "builder",
    title: "Тъмната секция „Създай своя десерт“",
    description: "Представя конфигуратора.",
    fields: [
      { key: "builderEyebrow", label: "Надзаглавие", kind: "line", max: 60, default: "Само тук" },
      { key: "builderCta", label: "Текст на бутона", kind: "line", max: 40, default: "Отвори конфигуратора" },
      { key: "builderTitle", label: "Заглавие", hint: TITLE_HINT, kind: "text", max: 120, default: "Създай" },
      { key: "builderAccent", label: "Акцент в заглавието", hint: ACCENT_HINT, kind: "line", max: 80, default: "своя десерт." },
      { key: "builderText", label: "Текст", kind: "text", max: 400, wide: true, default: "Изберете вид, вкус, размер, цветове и декорация — и вижте как десертът се променя пред вас, преди да поръчате." },
      {
        key: "builderPoints",
        label: "Номерирани точки",
        hint: "По една на ред.",
        kind: "list",
        max: 600,
        wide: true,
        default: [
          "Формата, етажите и покритието се сменят на живо.",
          "Цветовете на крема и декорацията се виждат веднага.",
          "Обобщението се обновява с всеки избор.",
        ].join("\n"),
      },
    ],
  },
  {
    id: "menu",
    title: "Категории от менюто",
    description: "Секцията с категориите десерти.",
    fields: [
      { key: "menuEyebrow", label: "Надзаглавие", kind: "line", max: 60, default: "Менюто" },
      { key: "menuTitle", label: "Заглавие", hint: TITLE_HINT, kind: "text", max: 120, default: "Изберете вида" },
      { key: "menuAccent", label: "Акцент в заглавието", hint: ACCENT_HINT, kind: "line", max: 80, default: "десерт." },
      { key: "menuIntro", label: "Текст", kind: "text", max: 400, wide: true, default: "Всяка категория води към конкретните предложения. Оттам можете да поръчате директно или да отворите конфигуратора." },
    ],
  },
  {
    id: "gallery",
    title: "Галерия",
    description:
      "Снимките, отбелязани в Галерия като „Показвай на началната страница“.",
    fields: [
      { key: "galleryEyebrow", label: "Надзаглавие", kind: "line", max: 60, default: "Работата" },
      { key: "galleryLink", label: "Текст на връзката", kind: "line", max: 40, default: "Цялата галерия" },
      { key: "galleryTitle", label: "Заглавие", hint: TITLE_HINT, kind: "text", max: 120, default: "Изработено" },
      { key: "galleryAccent", label: "Акцент в заглавието", hint: ACCENT_HINT, kind: "line", max: 80, default: "специално за вас." },
      { key: "galleryIntro", label: "Текст", kind: "text", max: 400, wide: true, default: "Подбрани проекти от работата на Cakes by ELI." },
    ],
  },
  {
    id: "about-extra",
    title: "За Ели — бутон",
    description: "Бутонът под текста „За Ели“.",
    fields: [
      { key: "aboutCta", label: "Текст на бутона", kind: "line", max: 40, default: "Разкажи ми за повода" },
    ],
  },
  {
    id: "process",
    title: "Как става",
    description: "Четирите стъпки на поръчката.",
    fields: [
      { key: "processEyebrow", label: "Надзаглавие", kind: "line", max: 60, default: "Как става" },
      { key: "processTitle", label: "Заглавие", hint: TITLE_HINT, kind: "text", max: 120, default: "От идея до\nготов десерт." },
      { key: "step1Title", label: "Стъпка 1 — заглавие", kind: "line", max: 40, default: "Избор" },
      { key: "step1Text", label: "Стъпка 1 — текст", kind: "text", max: 300, default: "Разгледайте менюто или отворете конфигуратора и съставете десерта стъпка по стъпка." },
      { key: "step2Title", label: "Стъпка 2 — заглавие", kind: "line", max: 40, default: "Детайли" },
      { key: "step2Text", label: "Стъпка 2 — текст", kind: "text", max: 300, default: "Повод, дата, брой порции, вкусове и всичко важно за поръчката." },
      { key: "step3Title", label: "Стъпка 3 — заглавие", kind: "line", max: 40, default: "Потвърждение" },
      { key: "step3Text", label: "Стъпка 3 — текст", kind: "text", max: 300, default: "Свързваме се с вас, уточняваме възможностите и потвърждаваме поръчката." },
      { key: "step4Title", label: "Стъпка 4 — заглавие", kind: "line", max: 40, default: "Готово" },
      { key: "step4Text", label: "Стъпка 4 — текст", kind: "text", max: 300, default: "Вземане на място в Плевен или доставка с Еконт, където е приложимо." },
    ],
  },
  {
    id: "contact",
    title: "Контактният блок най-долу",
    description: "Телефонът, адресът и социалните мрежи идват от „Данни за бизнеса“.",
    fields: [
      { key: "contactEyebrow", label: "Надзаглавие (тъмната част)", kind: "line", max: 60, default: "Поръчки и въпроси" },
      { key: "contactTitle", label: "Заглавие (тъмната част)", hint: TITLE_HINT, kind: "text", max: 120, default: "Най-бързо е\nпо телефона." },
      { key: "contactText", label: "Текст (тъмната част)", kind: "text", max: 300, wide: true, default: "Свободна дата и основните детайли се уточняват за минута." },
      { key: "studioEyebrow", label: "Надзаглавие (светлата част)", kind: "line", max: 60, default: "Ателието" },
      { key: "studioOrderCta", label: "Бутон за поръчка", kind: "line", max: 40, default: "Направи поръчка" },
      { key: "studioMapCta", label: "Бутон за картата", kind: "line", max: 40, default: "Виж на картата" },
    ],
  },
] as const satisfies readonly HomeSection[];

export type HomeContentKey =
  (typeof HOME_SECTIONS)[number]["fields"][number]["key"];

export type HomeContent = Record<HomeContentKey, string>;

export const HOME_FIELDS: readonly HomeField[] = HOME_SECTIONS.flatMap(
  (section) => section.fields as readonly HomeField[],
);

/** Stored values over defaults; unknown or non-string keys are ignored. */
export function resolveHomeContent(stored: unknown): HomeContent {
  const source =
    stored && typeof stored === "object" ? (stored as Record<string, unknown>) : {};
  const out = {} as Record<string, string>;
  for (const field of HOME_FIELDS) {
    const value = source[field.key];
    out[field.key] = typeof value === "string" ? value : field.default;
  }
  return out as HomeContent;
}

/** Splits a list field into its non-empty lines. */
export function homeList(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Reads the home-content fields out of a submitted form (named `home.<key>`),
 * normalising line endings, dropping control characters and trimming each
 * value to its field's maximum length.
 */
export function readHomeContentForm(
  formData: FormData,
  clean: (value: string) => string,
): HomeContent {
  const out = {} as Record<string, string>;
  for (const field of HOME_FIELDS) {
    const raw = formData.get(`home.${field.key}`);
    let value = typeof raw === "string" ? raw.replace(/\r\n?/g, "\n") : field.default;
    value = field.kind === "line" ? value.replace(/\n+/g, " ") : value;
    out[field.key] = clean(value).slice(0, field.max);
  }
  return out as HomeContent;
}
