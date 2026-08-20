/**
 * Seed content for Cakes by ELI.
 *
 * Two kinds of content live here and they are deliberately kept apart:
 *
 *  1. CONFIRMED — public business facts supplied by the client (name, phone,
 *     address, social profiles) and the copy from their reference design.
 *  2. DEMO — example categories, products, gallery items and configurator
 *     options so the application is explorable before the real catalogue
 *     exists. Everything demo is flagged `isDemo` or documented as such and
 *     is fully editable from the admin panel.
 *
 * No prices, allergens, ingredients or biography are invented. Demo prices are
 * only applied when the seed is run with `--demo-prices`.
 */

export type SeedOptionInput = {
  key: string;
  label: string;
  description?: string;
  previewValue?: string;
  swatchColor?: string;
  /** Applied only when the seed runs with --demo-prices. */
  demoPriceCents?: number;
};

export type SeedGroupInput = {
  key: string;
  label: string;
  helpText?: string;
  inputType?: "SINGLE" | "MULTI" | "TEXT" | "NUMBER";
  isRequired?: boolean;
  minSelect?: number;
  maxSelect?: number;
  maxLength?: number;
  placeholder?: string;
  previewChannel?: string;
  step: number;
  options?: SeedOptionInput[];
};

export type SeedRuleInput = {
  targetType: "GROUP" | "OPTION";
  targetKey: string;
  targetGroupKey?: string;
  mode?: "SHOW_WHEN" | "HIDE_WHEN";
  whenGroupKey: string;
  whenOptionKeys: string[];
};

export type SeedDessertType = {
  slug: string;
  name: string;
  renderer: string;
  description: string;
  categorySlug: string;
  demoBasePriceCents?: number;
  groups: SeedGroupInput[];
  rules?: SeedRuleInput[];
};

/* ------------------------------------------------------------------ *
 * Confirmed business information
 * ------------------------------------------------------------------ */

export const BUSINESS = {
  businessName: "Cakes by ELI",
  tagline: "handcrafted sweets",
  phone: "087 857 6728",
  email: "",
  addressLine: "пл. „Възраждане“ 1",
  city: "Плевен",
  mapsUrl: "https://maps.app.goo.gl/Qd1FjDnqqx7nTuVq6",
  facebookUrl: "https://www.facebook.com/chokolateatelieEli/",
  instagramUrl: "https://www.instagram.com/cakes_byeli_/",

  topbarText: "Бутикови торти и десерти • Плевен • Поръчки: 087 857 6728",
  heroEyebrow: "Създадено на ръка в Плевен",
  heroTitle: "Вкус, който",
  heroTitleAccent: "се помни.",
  heroSubtitle:
    "Бутикови торти, тематични сладки и десерти, създадени специално за вашия повод — с внимание към вкуса, детайла и цялостната визия.",

  aboutEyebrow: "Cakes by ELI",
  aboutTitle: "Когато вкусът\nсрещне детайла.",
  aboutText:
    "Идеята е всяка торта да бъде част от самия празник, а не просто десерт. Формата, цветовете, декорацията и вкусът се мислят като едно цяло.",
  aboutQuote: "Всеки повод има своя характер. Десертът трябва да го допълва.",

  contactIntro:
    "За дата, наличност и конкретна поръчка се свържете директно с Cakes by ELI.",
  orderDisclaimer:
    "Поръчката се счита за потвърдена след потвърждение от Cakes by ELI.",
  metaDescription:
    "Бутикови торти, еклери, макарони и десерти по поръчка в Плевен. Създайте свой десерт с онлайн конфигуратора на Cakes by ELI.",
} as const;

/* ------------------------------------------------------------------ *
 * Categories (starter set — fully editable in the admin panel)
 * ------------------------------------------------------------------ */

export const CATEGORIES: {
  slug: string;
  name: string;
  description: string;
  accent: string;
}[] = [
  {
    slug: "torti",
    name: "Торти",
    description:
      "Бутикови торти за рожден ден, юбилей, сватба, кръщене и всеки друг специален повод.",
    accent: "rose",
  },
  {
    slug: "ekleri",
    name: "Еклери",
    description:
      "Класически и авторски еклери с различни кремове, глазури и декорации.",
    accent: "chocolate",
  },
  {
    slug: "kapkeykove",
    name: "Къпкейкове",
    description:
      "Индивидуални сладки с крем и декорация, съобразени с темата на събитието.",
    accent: "blush",
  },
  {
    slug: "makaroni",
    name: "Макарони",
    description:
      "Френски макарони в подбрана цветова палитра и подаръчни опаковки.",
    accent: "sage",
  },
  {
    slug: "dekorirani-biskviti",
    name: "Декорирани бисквити",
    description:
      "Ръчно декорирани бисквити с айсинг — по тема, форма, цвят и надпис.",
    accent: "gold",
  },
  {
    slug: "keyk-pops",
    name: "Кейк попс",
    description: "Малки сладки на клечка с шоколадово покритие и декорация.",
    accent: "rose",
  },
  {
    slug: "mini-torti",
    name: "Мини торти",
    description:
      "Торти в умален размер — за малък повод или като част от сладък бар.",
    accent: "blush",
  },
  {
    slug: "tartaleti",
    name: "Тарталети",
    description: "Хрупкави кошнички с кремове, плодове и шоколад.",
    accent: "gold",
  },
  {
    slug: "chiyzkeykove",
    name: "Чийзкейкове",
    description: "Печени и непечени чийзкейкове с различни основи и топинги.",
    accent: "sage",
  },
  {
    slug: "desertni-kutii",
    name: "Десертни кутии и сладки барове",
    description:
      "Комбинация от няколко десерта с единна визия — за празненства и събития.",
    accent: "chocolate",
  },
];

/* ------------------------------------------------------------------ *
 * Shared option sets
 * ------------------------------------------------------------------ */

const SPONGES: SeedOptionInput[] = [
  { key: "vanilla", label: "Ванилов", previewValue: "#f2e2c4" },
  { key: "chocolate", label: "Шоколадов", previewValue: "#6b4430" },
  { key: "red-velvet", label: "Червено кадифе", previewValue: "#9d4148" },
  { key: "cocoa", label: "Какаов", previewValue: "#82573f" },
  { key: "lemon", label: "Лимонов", previewValue: "#eddfa8" },
];

const FILLINGS: SeedOptionInput[] = [
  { key: "vanilla", label: "Ванилов крем", previewValue: "#f6e9d2" },
  { key: "chocolate", label: "Шоколад", previewValue: "#6b4430" },
  { key: "white-chocolate", label: "Бял шоколад", previewValue: "#f4e6cf" },
  { key: "mascarpone", label: "Маскарпоне", previewValue: "#fbf2e4" },
  { key: "strawberry", label: "Ягода", previewValue: "#d9727c" },
  { key: "raspberry", label: "Малина", previewValue: "#b9455f" },
  { key: "forest-fruits", label: "Горски плодове", previewValue: "#8d4a6b" },
  { key: "pistachio", label: "Шамфъстък", previewValue: "#b6cb95" },
  { key: "caramel", label: "Карамел", previewValue: "#d5a05f" },
  { key: "cookies", label: "Бисквитен крем", previewValue: "#c8b8a6" },
  { key: "other", label: "Друго (ще уточня)", previewValue: "#e8dcc9" },
];

const FROSTING_COLORS: SeedOptionInput[] = [
  { key: "ivory", label: "Слонова кост", previewValue: "#fdf6ec", swatchColor: "#fdf6ec" },
  { key: "cream", label: "Кремаво", previewValue: "#f7e7d3", swatchColor: "#f7e7d3" },
  { key: "blush", label: "Пудра роза", previewValue: "#f2d7d7", swatchColor: "#f2d7d7" },
  { key: "rose", label: "Роза", previewValue: "#e3aeb6", swatchColor: "#e3aeb6" },
  { key: "dusty", label: "Прашно розово", previewValue: "#c98f99", swatchColor: "#c98f99" },
  { key: "burgundy", label: "Бордо", previewValue: "#8f4e5d", swatchColor: "#8f4e5d" },
  { key: "sage", label: "Градински чай", previewValue: "#bcc4ae", swatchColor: "#bcc4ae" },
  { key: "sky", label: "Светло синьо", previewValue: "#c6d6de", swatchColor: "#c6d6de" },
  { key: "lavender", label: "Лавандула", previewValue: "#d3c8dd", swatchColor: "#d3c8dd" },
  { key: "caramel", label: "Карамел", previewValue: "#d8ab74", swatchColor: "#d8ab74" },
  { key: "chocolate", label: "Шоколад", previewValue: "#7a4b34", swatchColor: "#7a4b34" },
  { key: "black", label: "Графит", previewValue: "#3a2a25", swatchColor: "#3a2a25" },
];

const DECORATIONS: SeedOptionInput[] = [
  { key: "strawberries", label: "Ягоди", previewValue: "strawberries" },
  { key: "raspberries", label: "Малини", previewValue: "raspberries" },
  { key: "blueberries", label: "Боровинки", previewValue: "blueberries" },
  { key: "macarons", label: "Макарони", previewValue: "macarons" },
  { key: "chocolate", label: "Шоколадови елементи", previewValue: "chocolate" },
  { key: "flowers", label: "Цветя", previewValue: "flowers" },
  { key: "pearls", label: "Захарни перли", previewValue: "pearls" },
  { key: "gold", label: "Златни детайли", previewValue: "gold" },
  { key: "sprinkles", label: "Поръска", previewValue: "sprinkles" },
  { key: "candles", label: "Свещички", previewValue: "candles" },
];

/* ------------------------------------------------------------------ *
 * Dessert types and their configurators
 * ------------------------------------------------------------------ */

export const DESSERT_TYPES: SeedDessertType[] = [
  /* ----------------------------- Торта ----------------------------- */
  {
    slug: "torta",
    name: "Торта",
    renderer: "cake",
    categorySlug: "torti",
    description:
      "Индивидуална торта — форма, етажи, блат, крем, покритие и декорация по ваш избор.",
    demoBasePriceCents: 4500,
    groups: [
      {
        key: "shape",
        label: "Форма",
        step: 1,
        previewChannel: "shape",
        isRequired: true,
        options: [
          { key: "round", label: "Кръгла", previewValue: "round" },
          { key: "square", label: "Квадратна", previewValue: "square" },
          { key: "rect", label: "Правоъгълна", previewValue: "rect" },
          { key: "heart", label: "Сърце", previewValue: "heart", demoPriceCents: 500 },
        ],
      },
      {
        key: "tiers",
        label: "Етажи",
        step: 1,
        previewChannel: "tiers",
        isRequired: true,
        helpText: "Многоетажните торти изискват повече време за изработка.",
        options: [
          { key: "1", label: "1 етаж", previewValue: "1" },
          { key: "2", label: "2 етажа", previewValue: "2", demoPriceCents: 2500 },
          { key: "3", label: "3 етажа", previewValue: "3", demoPriceCents: 5500 },
        ],
      },
      {
        key: "portions",
        label: "Порции",
        step: 2,
        isRequired: true,
        helpText: "Точният грамаж се уточнява при потвърждаване на поръчката.",
        options: [
          { key: "8-10", label: "8 – 10 порции" },
          { key: "12-15", label: "12 – 15 порции", demoPriceCents: 1200 },
          { key: "16-20", label: "16 – 20 порции", demoPriceCents: 2400 },
          { key: "20-25", label: "20 – 25 порции", demoPriceCents: 3600 },
          { key: "30+", label: "30+ порции", demoPriceCents: 5200 },
          { key: "custom", label: "Ще уточня по телефон" },
        ],
      },
      {
        key: "sponge",
        label: "Блат",
        step: 2,
        previewChannel: "sponge",
        isRequired: true,
        options: SPONGES,
      },
      {
        key: "filling",
        label: "Крем / пълнеж",
        step: 3,
        previewChannel: "filling",
        inputType: "MULTI",
        isRequired: true,
        minSelect: 1,
        maxSelect: 2,
        helpText: "Може да изберете до два крема.",
        options: FILLINGS,
      },
      {
        key: "exterior",
        label: "Покритие",
        step: 4,
        previewChannel: "frostingStyle",
        isRequired: true,
        options: [
          { key: "smooth", label: "Гладък крем", previewValue: "smooth" },
          { key: "textured", label: "Текстуриран крем", previewValue: "textured" },
          { key: "ganache", label: "Шоколадов ганаш", previewValue: "ganache" },
          { key: "drip", label: "Дрип (стичащ се шоколад)", previewValue: "drip" },
          { key: "naked", label: "Naked / semi-naked", previewValue: "naked" },
          { key: "fondant", label: "Фондан", previewValue: "fondant", demoPriceCents: 800 },
        ],
      },
      {
        key: "color",
        label: "Основен цвят",
        step: 4,
        previewChannel: "frostingColor",
        isRequired: true,
        options: FROSTING_COLORS,
      },
      {
        key: "dripColor",
        label: "Цвят на дрипа",
        step: 4,
        previewChannel: "dripColor",
        options: [
          { key: "dark", label: "Тъмен шоколад", previewValue: "#4f2f22", swatchColor: "#4f2f22" },
          { key: "milk", label: "Млечен шоколад", previewValue: "#7a4b34", swatchColor: "#7a4b34" },
          { key: "white", label: "Бял шоколад", previewValue: "#f4e6cf", swatchColor: "#f4e6cf" },
          { key: "caramel", label: "Карамел", previewValue: "#d8ab74", swatchColor: "#d8ab74" },
          { key: "rose", label: "Розов", previewValue: "#e3aeb6", swatchColor: "#e3aeb6" },
        ],
      },
      {
        key: "ribbon",
        label: "Акцент между етажите",
        step: 4,
        previewChannel: "ribbon",
        helpText: "Показва се само при торти с повече от един етаж.",
        options: [
          { key: "none", label: "Без акцент", previewValue: "none" },
          { key: "ribbon", label: "Панделка", previewValue: "ribbon" },
          { key: "gold-line", label: "Златна линия", previewValue: "gold-line" },
          { key: "pearls", label: "Ред перли", previewValue: "pearls" },
        ],
      },
      {
        key: "decoration",
        label: "Декорация",
        step: 5,
        previewChannel: "decoration",
        inputType: "MULTI",
        maxSelect: 5,
        helpText: "Изберете до пет елемента.",
        options: DECORATIONS,
      },
      {
        key: "topper",
        label: "Топер",
        step: 6,
        previewChannel: "topper",
        options: [
          { key: "none", label: "Без топер", previewValue: "none" },
          { key: "name", label: "Име", previewValue: "name" },
          { key: "number", label: "Число / възраст", previewValue: "number" },
          { key: "custom", label: "Персонален топер", previewValue: "custom" },
        ],
      },
      {
        key: "topperText",
        label: "Текст на топера",
        step: 6,
        previewChannel: "topperText",
        inputType: "TEXT",
        maxLength: 20,
        placeholder: "Напр. Мария или 18",
      },
      {
        key: "message",
        label: "Надпис върху тортата",
        step: 6,
        previewChannel: "message",
        inputType: "TEXT",
        maxLength: 40,
        placeholder: "Напр. Честит рожден ден, Мария!",
        helpText: "До 40 знака.",
      },
    ],
    rules: [
      {
        targetType: "GROUP",
        targetKey: "dripColor",
        whenGroupKey: "exterior",
        whenOptionKeys: ["drip"],
      },
      {
        targetType: "GROUP",
        targetKey: "ribbon",
        whenGroupKey: "tiers",
        whenOptionKeys: ["2", "3"],
      },
      {
        targetType: "GROUP",
        targetKey: "topperText",
        whenGroupKey: "topper",
        whenOptionKeys: ["name", "number", "custom"],
      },
      {
        targetType: "OPTION",
        targetKey: "3",
        targetGroupKey: "tiers",
        mode: "HIDE_WHEN",
        whenGroupKey: "shape",
        whenOptionKeys: ["heart"],
      },
    ],
  },

  /* ----------------------------- Еклери ---------------------------- */
  {
    slug: "ekler",
    name: "Еклери",
    renderer: "eclair",
    categorySlug: "ekleri",
    description:
      "Авторски еклери — пълнеж, глазура, декорация и количество по ваш избор.",
    demoBasePriceCents: 1800,
    groups: [
      {
        key: "quantity",
        label: "Количество",
        step: 1,
        previewChannel: "count",
        isRequired: true,
        options: [
          { key: "6", label: "6 броя", previewValue: "6" },
          { key: "12", label: "12 броя", previewValue: "12", demoPriceCents: 1600 },
          { key: "18", label: "18 броя", previewValue: "18", demoPriceCents: 3100 },
          { key: "24", label: "24 броя", previewValue: "24", demoPriceCents: 4500 },
          { key: "custom", label: "Друго количество", previewValue: "12" },
        ],
      },
      {
        key: "quantityCustom",
        label: "Желан брой",
        step: 1,
        inputType: "NUMBER",
        placeholder: "Напр. 40",
      },
      {
        key: "filling",
        label: "Пълнеж",
        step: 2,
        previewChannel: "filling",
        isRequired: true,
        options: [
          { key: "vanilla", label: "Ванилия", previewValue: "#f6e9d2" },
          { key: "chocolate", label: "Шоколад", previewValue: "#6b4430" },
          { key: "pistachio", label: "Шамфъстък", previewValue: "#b6cb95" },
          { key: "caramel", label: "Карамел", previewValue: "#d5a05f" },
          { key: "raspberry", label: "Малина", previewValue: "#b9455f" },
          { key: "strawberry", label: "Ягода", previewValue: "#d9727c" },
          { key: "coffee", label: "Кафе", previewValue: "#6d4a35" },
        ],
      },
      {
        key: "glaze",
        label: "Глазура",
        step: 3,
        previewChannel: "glaze",
        isRequired: true,
        options: [
          { key: "dark", label: "Тъмен шоколад", previewValue: "#4f2f22", swatchColor: "#4f2f22" },
          { key: "milk", label: "Млечен шоколад", previewValue: "#7a4b34", swatchColor: "#7a4b34" },
          { key: "white", label: "Бял шоколад", previewValue: "#f4e6cf", swatchColor: "#f4e6cf" },
          { key: "pistachio", label: "Шамфъстък", previewValue: "#bfd0a0", swatchColor: "#bfd0a0" },
          { key: "fruit", label: "Плодова глазура", previewValue: "#d1697a", swatchColor: "#d1697a" },
        ],
      },
      {
        key: "decoration",
        label: "Декорация",
        step: 4,
        previewChannel: "decoration",
        inputType: "MULTI",
        maxSelect: 3,
        options: [
          { key: "nuts", label: "Ядки", previewValue: "nuts" },
          { key: "pistachio", label: "Шамфъстък", previewValue: "pistachio" },
          { key: "raspberry", label: "Сушена малина", previewValue: "raspberry" },
          { key: "chocolate", label: "Шоколадови парченца", previewValue: "chocolate" },
          { key: "gold", label: "Златен детайл", previewValue: "gold" },
          { key: "sprinkles", label: "Поръска", previewValue: "sprinkles" },
        ],
      },
      {
        key: "packaging",
        label: "Опаковка",
        step: 5,
        options: [
          { key: "box", label: "Кутия" },
          { key: "gift", label: "Подаръчна кутия с панделка", demoPriceCents: 300 },
          { key: "tray", label: "Табла за събитие" },
        ],
      },
    ],
    rules: [
      {
        targetType: "GROUP",
        targetKey: "quantityCustom",
        whenGroupKey: "quantity",
        whenOptionKeys: ["custom"],
      },
    ],
  },

  /* --------------------------- Къпкейкове -------------------------- */
  {
    slug: "kapkeyk",
    name: "Къпкейкове",
    renderer: "cupcake",
    categorySlug: "kapkeykove",
    description: "Индивидуални сладки с крем, декорация и тема по избор.",
    groups: [
      {
        key: "quantity",
        label: "Количество",
        step: 1,
        previewChannel: "count",
        isRequired: true,
        options: [
          { key: "6", label: "6 броя", previewValue: "6" },
          { key: "12", label: "12 броя", previewValue: "12" },
          { key: "24", label: "24 броя", previewValue: "24" },
          { key: "custom", label: "Друго количество", previewValue: "12" },
        ],
      },
      {
        key: "quantityCustom",
        label: "Желан брой",
        step: 1,
        inputType: "NUMBER",
        placeholder: "Напр. 30",
      },
      {
        key: "sponge",
        label: "Блат",
        step: 2,
        previewChannel: "sponge",
        isRequired: true,
        options: SPONGES,
      },
      {
        key: "filling",
        label: "Пълнеж",
        step: 2,
        previewChannel: "filling",
        options: FILLINGS.slice(0, 8),
      },
      {
        key: "frosting",
        label: "Крем отгоре",
        step: 3,
        previewChannel: "frostingStyle",
        isRequired: true,
        options: [
          { key: "swirl", label: "Спирала", previewValue: "swirl" },
          { key: "rose", label: "Розета", previewValue: "rose" },
          { key: "smooth", label: "Гладък купол", previewValue: "smooth" },
        ],
      },
      {
        key: "color",
        label: "Цвят на крема",
        step: 3,
        previewChannel: "frostingColor",
        isRequired: true,
        options: FROSTING_COLORS,
      },
      {
        key: "decoration",
        label: "Декорация",
        step: 4,
        previewChannel: "decoration",
        inputType: "MULTI",
        maxSelect: 4,
        options: [
          { key: "sprinkles", label: "Поръска", previewValue: "sprinkles" },
          { key: "fruit", label: "Плодове", previewValue: "fruit" },
          { key: "chocolate", label: "Шоколад", previewValue: "chocolate" },
          { key: "gold", label: "Златни детайли", previewValue: "gold" },
          { key: "flowers", label: "Цветя", previewValue: "flowers" },
          { key: "topper", label: "Мини топери", previewValue: "topper" },
        ],
      },
      {
        key: "theme",
        label: "Тема",
        step: 5,
        inputType: "TEXT",
        maxLength: 60,
        placeholder: "Напр. рожден ден, бебешко парти, корпоративно събитие",
      },
      {
        key: "message",
        label: "Надпис / послание",
        step: 5,
        previewChannel: "message",
        inputType: "TEXT",
        maxLength: 30,
        placeholder: "Напр. Честито!",
      },
    ],
    rules: [
      {
        targetType: "GROUP",
        targetKey: "quantityCustom",
        whenGroupKey: "quantity",
        whenOptionKeys: ["custom"],
      },
    ],
  },

  /* ---------------------------- Макарони --------------------------- */
  {
    slug: "makaron",
    name: "Макарони",
    renderer: "macaron",
    categorySlug: "makaroni",
    description:
      "Френски макарони — цветова палитра, пълнеж и опаковка по ваш избор.",
    groups: [
      {
        key: "quantity",
        label: "Количество",
        step: 1,
        previewChannel: "count",
        isRequired: true,
        options: [
          { key: "6", label: "6 броя", previewValue: "6" },
          { key: "12", label: "12 броя", previewValue: "12" },
          { key: "24", label: "24 броя", previewValue: "24" },
          { key: "custom", label: "Друго количество", previewValue: "12" },
        ],
      },
      {
        key: "quantityCustom",
        label: "Желан брой",
        step: 1,
        inputType: "NUMBER",
        placeholder: "Напр. 50",
      },
      {
        key: "shellColors",
        label: "Цветове на черупките",
        step: 2,
        previewChannel: "shellColors",
        inputType: "MULTI",
        isRequired: true,
        minSelect: 1,
        maxSelect: 4,
        helpText: "Изберете до четири цвята за комбинацията.",
        options: FROSTING_COLORS.filter((c) => c.key !== "black"),
      },
      {
        key: "filling",
        label: "Пълнеж",
        step: 3,
        previewChannel: "filling",
        inputType: "MULTI",
        isRequired: true,
        minSelect: 1,
        maxSelect: 3,
        options: FILLINGS.slice(0, 9),
      },
      {
        key: "packaging",
        label: "Опаковка",
        step: 4,
        options: [
          { key: "box", label: "Стандартна кутия" },
          { key: "gift", label: "Подаръчна кутия с панделка" },
          { key: "tower", label: "Кула от макарони" },
        ],
      },
      {
        key: "messageCard",
        label: "Текст за картичка",
        step: 4,
        inputType: "TEXT",
        maxLength: 80,
        placeholder: "Напр. Честит празник!",
      },
    ],
    rules: [
      {
        targetType: "GROUP",
        targetKey: "quantityCustom",
        whenGroupKey: "quantity",
        whenOptionKeys: ["custom"],
      },
    ],
  },

  /* ---------------------- Декорирани бисквити ---------------------- */
  {
    slug: "biskviti",
    name: "Декорирани бисквити",
    renderer: "cookie",
    categorySlug: "dekorirani-biskviti",
    description: "Ръчно декорирани бисквити с айсинг — форма, тема и надпис.",
    groups: [
      {
        key: "quantity",
        label: "Количество",
        step: 1,
        previewChannel: "count",
        isRequired: true,
        options: [
          { key: "6", label: "6 броя", previewValue: "6" },
          { key: "12", label: "12 броя", previewValue: "12" },
          { key: "20", label: "20 броя", previewValue: "20" },
          { key: "custom", label: "Друго количество", previewValue: "12" },
        ],
      },
      {
        key: "quantityCustom",
        label: "Желан брой",
        step: 1,
        inputType: "NUMBER",
        placeholder: "Напр. 35",
      },
      {
        key: "shape",
        label: "Форма",
        step: 2,
        previewChannel: "shape",
        isRequired: true,
        options: [
          { key: "round", label: "Кръгла", previewValue: "round" },
          { key: "square", label: "Квадратна", previewValue: "square" },
          { key: "heart", label: "Сърце", previewValue: "heart" },
          { key: "star", label: "Звезда", previewValue: "star" },
          { key: "custom", label: "Тематична форма", previewValue: "round" },
        ],
      },
      {
        key: "icingColors",
        label: "Цветове на айсинга",
        step: 3,
        previewChannel: "icingColors",
        inputType: "MULTI",
        isRequired: true,
        minSelect: 1,
        maxSelect: 4,
        options: FROSTING_COLORS,
      },
      {
        key: "theme",
        label: "Тема",
        step: 4,
        inputType: "TEXT",
        maxLength: 60,
        placeholder: "Напр. Коледа, кръщене, сватба",
      },
      {
        key: "text",
        label: "Имена / надпис",
        step: 4,
        previewChannel: "message",
        inputType: "TEXT",
        maxLength: 40,
        placeholder: "Напр. Мария и Иван",
      },
      {
        key: "packaging",
        label: "Опаковка",
        step: 5,
        options: [
          { key: "single", label: "Индивидуално пакетирани" },
          { key: "box", label: "В обща кутия" },
          { key: "gift", label: "Подаръчна опаковка" },
        ],
      },
    ],
    rules: [
      {
        targetType: "GROUP",
        targetKey: "quantityCustom",
        whenGroupKey: "quantity",
        whenOptionKeys: ["custom"],
      },
    ],
  },

  /* ---------------------------- Кейк попс -------------------------- */
  {
    slug: "keyk-pops",
    name: "Кейк попс",
    renderer: "cakepop",
    categorySlug: "keyk-pops",
    description: "Сладки на клечка с шоколадово покритие и декорация.",
    groups: [
      {
        key: "quantity",
        label: "Количество",
        step: 1,
        previewChannel: "count",
        isRequired: true,
        options: [
          { key: "10", label: "10 броя", previewValue: "10" },
          { key: "20", label: "20 броя", previewValue: "20" },
          { key: "30", label: "30 броя", previewValue: "30" },
          { key: "custom", label: "Друго количество", previewValue: "20" },
        ],
      },
      {
        key: "quantityCustom",
        label: "Желан брой",
        step: 1,
        inputType: "NUMBER",
        placeholder: "Напр. 45",
      },
      {
        key: "coating",
        label: "Покритие",
        step: 2,
        previewChannel: "coating",
        isRequired: true,
        options: [
          { key: "dark", label: "Тъмен шоколад", previewValue: "#4f2f22", swatchColor: "#4f2f22" },
          { key: "milk", label: "Млечен шоколад", previewValue: "#7a4b34", swatchColor: "#7a4b34" },
          { key: "white", label: "Бял шоколад", previewValue: "#f4e6cf", swatchColor: "#f4e6cf" },
          { key: "colored", label: "Цветна глазура", previewValue: "#e3aeb6", swatchColor: "#e3aeb6" },
        ],
      },
      {
        key: "color",
        label: "Основен цвят",
        step: 2,
        previewChannel: "frostingColor",
        options: FROSTING_COLORS,
      },
      {
        key: "decoration",
        label: "Декорация",
        step: 3,
        previewChannel: "decoration",
        inputType: "MULTI",
        maxSelect: 3,
        options: [
          { key: "sprinkles", label: "Поръска", previewValue: "sprinkles" },
          { key: "drizzle", label: "Шоколадови линии", previewValue: "drizzle" },
          { key: "gold", label: "Златни детайли", previewValue: "gold" },
          { key: "pearls", label: "Захарни перли", previewValue: "pearls" },
        ],
      },
      {
        key: "theme",
        label: "Тема",
        step: 4,
        inputType: "TEXT",
        maxLength: 60,
        placeholder: "Напр. бебешко парти",
      },
    ],
    rules: [
      {
        targetType: "GROUP",
        targetKey: "quantityCustom",
        whenGroupKey: "quantity",
        whenOptionKeys: ["custom"],
      },
      {
        targetType: "GROUP",
        targetKey: "color",
        whenGroupKey: "coating",
        whenOptionKeys: ["colored"],
      },
    ],
  },

  /* --------------------------- Мини торти -------------------------- */
  {
    slug: "mini-torta",
    name: "Мини торта",
    renderer: "cake",
    categorySlug: "mini-torti",
    description: "Торта в умален размер — за малък повод или за сладък бар.",
    groups: [
      {
        key: "shape",
        label: "Форма",
        step: 1,
        previewChannel: "shape",
        isRequired: true,
        options: [
          { key: "round", label: "Кръгла", previewValue: "round" },
          { key: "square", label: "Квадратна", previewValue: "square" },
          { key: "heart", label: "Сърце", previewValue: "heart" },
        ],
      },
      {
        key: "portions",
        label: "Порции",
        step: 1,
        isRequired: true,
        options: [
          { key: "2-4", label: "2 – 4 порции" },
          { key: "4-6", label: "4 – 6 порции" },
          { key: "6-8", label: "6 – 8 порции" },
        ],
      },
      {
        key: "sponge",
        label: "Блат",
        step: 2,
        previewChannel: "sponge",
        isRequired: true,
        options: SPONGES,
      },
      {
        key: "filling",
        label: "Крем",
        step: 2,
        previewChannel: "filling",
        isRequired: true,
        options: FILLINGS,
      },
      {
        key: "exterior",
        label: "Покритие",
        step: 3,
        previewChannel: "frostingStyle",
        isRequired: true,
        options: [
          { key: "smooth", label: "Гладък крем", previewValue: "smooth" },
          { key: "textured", label: "Текстуриран крем", previewValue: "textured" },
          { key: "drip", label: "Дрип", previewValue: "drip" },
          { key: "naked", label: "Naked", previewValue: "naked" },
        ],
      },
      {
        key: "color",
        label: "Цвят",
        step: 3,
        previewChannel: "frostingColor",
        isRequired: true,
        options: FROSTING_COLORS,
      },
      {
        key: "decoration",
        label: "Декорация",
        step: 4,
        previewChannel: "decoration",
        inputType: "MULTI",
        maxSelect: 3,
        options: DECORATIONS.slice(0, 8),
      },
      {
        key: "message",
        label: "Надпис",
        step: 5,
        previewChannel: "message",
        inputType: "TEXT",
        maxLength: 30,
        placeholder: "Напр. Обичам те",
      },
    ],
  },

  /* --------------------------- Тарталети --------------------------- */
  {
    slug: "tartaleti",
    name: "Тарталети",
    renderer: "generic",
    categorySlug: "tartaleti",
    description: "Хрупкави кошнички с кремове, плодове и шоколад.",
    groups: [
      {
        key: "quantity",
        label: "Количество",
        step: 1,
        previewChannel: "count",
        isRequired: true,
        options: [
          { key: "6", label: "6 броя", previewValue: "6" },
          { key: "12", label: "12 броя", previewValue: "12" },
          { key: "24", label: "24 броя", previewValue: "24" },
        ],
      },
      {
        key: "shell",
        label: "Кошничка",
        step: 2,
        isRequired: true,
        options: [
          { key: "classic", label: "Класическа" },
          { key: "cocoa", label: "Какаова" },
          { key: "almond", label: "Бадемова" },
        ],
      },
      {
        key: "cream",
        label: "Крем",
        step: 2,
        previewChannel: "frostingColor",
        isRequired: true,
        options: FILLINGS.slice(0, 9).map((f) => ({ ...f, swatchColor: f.previewValue })),
      },
      {
        key: "topping",
        label: "Топинг",
        step: 3,
        previewChannel: "decoration",
        inputType: "MULTI",
        maxSelect: 3,
        options: [
          { key: "strawberry", label: "Ягоди", previewValue: "strawberries" },
          { key: "raspberry", label: "Малини", previewValue: "raspberries" },
          { key: "blueberry", label: "Боровинки", previewValue: "blueberries" },
          { key: "chocolate", label: "Шоколад", previewValue: "chocolate" },
          { key: "nuts", label: "Ядки", previewValue: "nuts" },
          { key: "gold", label: "Златни детайли", previewValue: "gold" },
        ],
      },
    ],
  },

  /* -------------------------- Чийзкейкове -------------------------- */
  {
    slug: "chiyzkeyk",
    name: "Чийзкейк",
    renderer: "cake",
    categorySlug: "chiyzkeykove",
    description: "Печен или непечен чийзкейк с избрана основа и топинг.",
    groups: [
      {
        key: "size",
        label: "Размер",
        step: 1,
        isRequired: true,
        options: [
          { key: "small", label: "Малък (6 – 8 порции)" },
          { key: "medium", label: "Среден (10 – 12 порции)" },
          { key: "large", label: "Голям (16 – 20 порции)" },
        ],
      },
      {
        key: "shape",
        label: "Форма",
        step: 1,
        previewChannel: "shape",
        isRequired: true,
        options: [
          { key: "round", label: "Кръгла", previewValue: "round" },
          { key: "square", label: "Квадратна", previewValue: "square" },
          { key: "heart", label: "Сърце", previewValue: "heart" },
        ],
      },
      {
        key: "base",
        label: "Основа",
        step: 2,
        previewChannel: "sponge",
        isRequired: true,
        options: [
          { key: "biscuit", label: "Бисквитена", previewValue: "#c8ab86" },
          { key: "cocoa", label: "Какаова бисквита", previewValue: "#7a5540" },
          { key: "nuts", label: "Ядкова", previewValue: "#b9986f" },
        ],
      },
      {
        key: "flavor",
        label: "Вкус",
        step: 2,
        previewChannel: "filling",
        isRequired: true,
        options: [
          { key: "classic", label: "Класически", previewValue: "#f6eddd" },
          { key: "vanilla", label: "Ванилия", previewValue: "#f6e9d2" },
          { key: "chocolate", label: "Шоколад", previewValue: "#6b4430" },
          { key: "lemon", label: "Лимон", previewValue: "#eddfa8" },
          { key: "forest-fruits", label: "Горски плодове", previewValue: "#8d4a6b" },
          { key: "caramel", label: "Карамел", previewValue: "#d5a05f" },
        ],
      },
      {
        key: "color",
        label: "Цвят на повърхността",
        step: 3,
        previewChannel: "frostingColor",
        isRequired: true,
        options: FROSTING_COLORS.slice(0, 8),
      },
      {
        key: "topping",
        label: "Топинг и декорация",
        step: 3,
        previewChannel: "decoration",
        inputType: "MULTI",
        maxSelect: 4,
        options: DECORATIONS.slice(0, 9),
      },
      {
        key: "message",
        label: "Надпис",
        step: 4,
        previewChannel: "message",
        inputType: "TEXT",
        maxLength: 30,
        placeholder: "Незадължително",
      },
    ],
  },

  /* -------------------- Десертни кутии / барове -------------------- */
  {
    slug: "sladak-bar",
    name: "Десертна кутия / сладък бар",
    renderer: "generic",
    categorySlug: "desertni-kutii",
    description:
      "Комбинация от няколко десерта с единна визия за вашето събитие.",
    groups: [
      {
        key: "people",
        label: "Брой гости",
        step: 1,
        inputType: "NUMBER",
        isRequired: true,
        placeholder: "Напр. 40",
      },
      {
        key: "types",
        label: "Видове десерти",
        step: 2,
        previewChannel: "assortment",
        inputType: "MULTI",
        isRequired: true,
        minSelect: 2,
        maxSelect: 6,
        helpText: "Изберете между два и шест вида.",
        options: [
          { key: "mini-cakes", label: "Мини торти", previewValue: "cake" },
          { key: "eclairs", label: "Еклери", previewValue: "eclair" },
          { key: "cupcakes", label: "Къпкейкове", previewValue: "cupcake" },
          { key: "macarons", label: "Макарони", previewValue: "macaron" },
          { key: "cookies", label: "Бисквити", previewValue: "cookie" },
          { key: "cake-pops", label: "Кейк попс", previewValue: "cakepop" },
          { key: "tartlets", label: "Тарталети", previewValue: "tartlet" },
        ],
      },
      {
        key: "palette",
        label: "Цветова палитра",
        step: 3,
        previewChannel: "frostingColor",
        inputType: "MULTI",
        isRequired: true,
        minSelect: 1,
        maxSelect: 3,
        options: FROSTING_COLORS,
      },
      {
        key: "event",
        label: "Тип събитие",
        step: 4,
        options: [
          { key: "birthday", label: "Рожден ден" },
          { key: "wedding", label: "Сватба" },
          { key: "christening", label: "Кръщене" },
          { key: "corporate", label: "Корпоративно събитие" },
          { key: "other", label: "Друго" },
        ],
      },
      {
        key: "presentation",
        label: "Бележки за подредбата",
        step: 4,
        inputType: "TEXT",
        maxLength: 200,
        placeholder: "Напр. поставки на два нива, златни детайли…",
      },
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Demo products (clearly flagged, fully editable, no invented prices
 * unless the seed is run with --demo-prices)
 * ------------------------------------------------------------------ */

export const DEMO_PRODUCTS: {
  slug: string;
  name: string;
  categorySlug: string;
  dessertTypeSlug?: string;
  shortDescription: string;
  description: string;
  portions?: string;
  isFeatured?: boolean;
  isCustomizable?: boolean;
  shippingAllowed?: boolean;
  demoPriceCents?: number;
  shipWeightKg?: string;
  shipLengthCm?: number;
  shipWidthCm?: number;
  shipHeightCm?: number;
}[] = [
  {
    slug: "torta-nezhen-cvyat",
    name: "Торта „Нежен цвят“",
    categorySlug: "torti",
    dessertTypeSlug: "torta",
    shortDescription: "Двуетажна торта с пудрен крем и свежи плодове.",
    description:
      "Двуетажна торта с гладко кремово покритие в пудрен нюанс, декорирана със сезонни плодове и фини златни детайли.",
    portions: "20 – 25 порции",
    isFeatured: true,
    isCustomizable: true,
    demoPriceCents: 9800,
  },
  {
    slug: "torta-shokolad-i-malina",
    name: "Торта „Шоколад и малина“",
    categorySlug: "torti",
    dessertTypeSlug: "torta",
    shortDescription: "Шоколадов блат, малинов крем и дрип от тъмен шоколад.",
    description:
      "Шоколадов блат с малинов крем, покрит с ганаш и дрип от тъмен шоколад, с малини и шоколадови елементи.",
    portions: "16 – 20 порции",
    isFeatured: true,
    isCustomizable: true,
    demoPriceCents: 8400,
  },
  {
    slug: "ekleri-klasika",
    name: "Еклери „Класика“",
    categorySlug: "ekleri",
    dessertTypeSlug: "ekler",
    shortDescription: "Ванилов крем и глазура от тъмен шоколад.",
    description:
      "Класически еклери с ванилов крем и глазура от тъмен шоколад. Предлагат се в кутия по 6, 12 или повече броя.",
    isFeatured: true,
    isCustomizable: true,
    shippingAllowed: true,
    demoPriceCents: 1800,
    shipWeightKg: "1.20",
    shipLengthCm: 30,
    shipWidthCm: 20,
    shipHeightCm: 12,
  },
  {
    slug: "ekleri-shamfastak",
    name: "Еклери „Шамфъстък“",
    categorySlug: "ekleri",
    dessertTypeSlug: "ekler",
    shortDescription: "Шамфъстъков крем и зелена глазура с ядки.",
    description:
      "Еклери с крем от шамфъстък, шамфъстъкова глазура и трошени ядки.",
    isCustomizable: true,
    shippingAllowed: true,
    demoPriceCents: 2100,
    shipWeightKg: "1.20",
    shipLengthCm: 30,
    shipWidthCm: 20,
    shipHeightCm: 12,
  },
  {
    slug: "makaroni-pastel",
    name: "Макарони „Пастел“",
    categorySlug: "makaroni",
    dessertTypeSlug: "makaron",
    shortDescription: "Комбинация от четири пастелни цвята.",
    description:
      "Френски макарони в пастелна палитра, подходящи за подарък или за сладък бар.",
    isFeatured: true,
    isCustomizable: true,
    shippingAllowed: true,
    demoPriceCents: 2400,
    shipWeightKg: "0.60",
    shipLengthCm: 25,
    shipWidthCm: 18,
    shipHeightCm: 8,
  },
  {
    slug: "kapkeykove-rozeta",
    name: "Къпкейкове „Розета“",
    categorySlug: "kapkeykove",
    dessertTypeSlug: "kapkeyk",
    shortDescription: "Ванилов блат с крем розета и поръска.",
    description:
      "Ванилови къпкейкове с крем във форма на розета, декорирани с поръска и мини топери по темата на събитието.",
    isCustomizable: true,
    demoPriceCents: 2200,
  },
  {
    slug: "biskviti-tematichni",
    name: "Декорирани бисквити по тема",
    categorySlug: "dekorirani-biskviti",
    dessertTypeSlug: "biskviti",
    shortDescription: "Ръчно декорирани с айсинг по ваша тема.",
    description:
      "Бисквити с ръчна декорация от айсинг — форма, цветове и надписи според повода.",
    isCustomizable: true,
    shippingAllowed: true,
    demoPriceCents: 1600,
    shipWeightKg: "0.80",
    shipLengthCm: 28,
    shipWidthCm: 20,
    shipHeightCm: 8,
  },
  {
    slug: "mini-torta-serdce",
    name: "Мини торта „Сърце“",
    categorySlug: "mini-torti",
    dessertTypeSlug: "mini-torta",
    shortDescription: "Малка торта за двама с форма на сърце.",
    description:
      "Мини торта с форма на сърце, гладко покритие и дискретна декорация.",
    isFeatured: true,
    isCustomizable: true,
    demoPriceCents: 3600,
  },
  {
    slug: "chiyzkeyk-gorski-plodove",
    name: "Чийзкейк „Горски плодове“",
    categorySlug: "chiyzkeykove",
    dessertTypeSlug: "chiyzkeyk",
    shortDescription: "Бисквитена основа и топинг от горски плодове.",
    description:
      "Чийзкейк на бисквитена основа с топинг от горски плодове и свежи плодове отгоре.",
    isCustomizable: true,
    demoPriceCents: 4200,
  },
  {
    slug: "sladak-bar-sabitie",
    name: "Сладък бар за събитие",
    categorySlug: "desertni-kutii",
    dessertTypeSlug: "sladak-bar",
    shortDescription: "Комбинация от няколко десерта с единна визия.",
    description:
      "Подбор от мини торти, еклери, макарони и бисквити с обща цветова концепция за вашето събитие.",
    isCustomizable: true,
  },
];

/** Captions for the generated demo gallery artwork. */
export const DEMO_GALLERY: { caption: string; categorySlug: string }[] = [
  { caption: "Двуетажна торта с пудрен крем", categorySlug: "torti" },
  { caption: "Шоколадов дрип и малини", categorySlug: "torti" },
  { caption: "Еклери с шамфъстъкова глазура", categorySlug: "ekleri" },
  { caption: "Макарони в пастелна палитра", categorySlug: "makaroni" },
  { caption: "Къпкейкове с крем розета", categorySlug: "kapkeykove" },
  { caption: "Мини торта с форма на сърце", categorySlug: "mini-torti" },
  { caption: "Декорирани бисквити по тема", categorySlug: "dekorirani-biskviti" },
  { caption: "Сладък бар за събитие", categorySlug: "desertni-kutii" },
];
