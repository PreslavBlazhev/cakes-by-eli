# Cakes by ELI — технически одит: повтарящи се Out-of-Memory сривове в Render

**Тип на работата:** READ-ONLY диагностика. Source кодът не е променян, нищо не е
commit-нато, push-нато или деплойнато. Единственият създаден файл е този отчет.

**Дата на одита:** 09.09.2026
**Одитирана версия:** `main` @ `6e9699622950cd088ae024b8f4becd9862c9609b`
**Работно дърво преди и след одита:** чисто (`git status --short` не връща нищо)

**Извършени промени извън source кода** (нужни, за да се изпълнят исканите проверки):

| Действие | Причина | Обратимо |
|---|---|---|
| `npm ci` | Локално бяха инсталирани само production зависимости — без `eslint`, `typescript`, `vitest` нито една от исканите проверки не може да се изпълни. | да, `npm ci --omit=dev` |
| `npm run build` | Исканата production build проверка. Презаписа `.next/`. | да, `rm -rf .next` |
| `.next/cache/images` изтрит няколко пъти | Част от memory теста — форсира прекодиране. | да, регенерира се |

> ⚠️ **След този одит `.next` съдържа production билд.** Проектното правило „не
> смесвай `next build` и `next dev` върху едно `.next`" важи: преди следващия
> `npm run dev` изтрий `.next`, иначе част от маршрутите ще връщат 404.

Тестовият probe за памет живее **извън** проекта (в scratchpad директорията) и се
зарежда през `NODE_OPTIONS=--require`, за да не се пипа кодът.

---

## 1. Executive Summary

**Най-вероятната причина: няма класически JavaScript memory leak. Има доказано
високо *плато* от native (не-JS) памет, което Next.js image оптимизаторът чрез
sharp/libvips изгражда и не връща на операционната система, плюс доказани големи
преходни пикове от два източника — конкурентна AVIF оптимизация и публичния
Еконт lookup endpoint, който тегли 17 MB JSON. Върху 512 MB лимит това плато
плюс пиковете надхвърля тавана; V8 няма причина да събира агресивно, защото Node
изчислява heap лимита от паметта на *хоста* (тук 4 144 MB), не от лимита на
контейнера.**

Ниво на увереност:

| Твърдение | Увереност |
|---|---|
| Няма JS heap leak (задържани JavaScript обекти) | **92 %** — `heapUsed` остава 49,7 MB неизменно през 900+ image кодирания, 140 page render-а и Еконт заявки |
| Image оптимизаторът (sharp/libvips) е основният консуматор | **72 %** |
| `/api/econt/lookup?kind=cities` е втори голям, доказан източник на пикове | **85 %**, че допринася; **~35 %**, че самò е причина за конкретен OOM |
| Има реален неограничен растеж в `caches.streets` (истински, но малък leak) | **95 %**, че кодът е неограничен; **~25 %**, че допринася съществено |
| Липсата на `--max-old-space-size` утежнява всичко изброено | **80 %** |

**Доказан memory leak или подозрение?**
Доказано е следното, с числа:

* **Не** — няма растеж на JavaScript heap-а. `heapUsed` е плосък.
* **Да** — има **native/RSS ratchet**: след webp sweep RSS остава +33,9 MB над
  базата въпреки два принудителни GC; след AVIF sweep още +20,2 MB; след
  8-паралелен AVIF burst още +17,9 MB. `external` и `arrayBuffers` се връщат
  **точно** на изходните стойности — значи паметта е освободена от Node, но не
  е върната на ОС. Това е libvips/allocator задържане, не leak в кода.
* **Да** — има **един истински неограничен растеж**: `caches.streets` е `Map` без
  таван, чиито ключове идват от непроверен потребителски вход (виж 4.2).
* Растежът от image оптимизатора **достига плато** — четири допълнителни кръга
  пълно прекодиране (448 кодирания) не го покачиха повече.

**512 MB → 1 GB: решение или отлагане?**
**Отлагане с голяма практическа полза.** Измерената production-съотносима
резидентна памет е ~148 MB в покой, ~190 MB след поредица оптимизации и **~280 MB
пик при 8 паралелни AVIF заявки**. Това се вписва в 1 GB с удобен резерв и почти
сигурно ще спре сривовете веднага. Но **не поправя причината**: конкурентността
на image оптимизатора не е ограничена отгоре, а `caches.streets` расте
неограничено — достатъчно агресивен бот може да събори и 1 GB инстанция.
Правилният ред е: 1 GB като спешна мярка (P0), после реалните корекции (P1),
после евентуално връщане на 512 MB.

**Има ли риск за потребителски данни, поръчки или снимки?** Не при самите
сривове — виж раздел 14.

---

## 2. Project and Runtime Configuration

### Branch и commit

```
branch : main
commit : 6e9699622950cd088ae024b8f4becd9862c9609b
        „Draw the heart as a heart, and let it stack"
status : чисто работно дърво (преди и след одита)
```

### Версии

| Компонент | Декларирано | Инсталирано локално | В Render |
|---|---|---|---|
| Node.js | `engines.node >= 20.9.0` | **v21.5.0** (одитната машина) | `NODE_VERSION=22` (render.yaml) |
| npm | — | 10.2.4 | идва с Node 22 |
| Next.js | `^16.3.1` | **16.3.1** | 16.3.1 |
| React / React DOM | `^19.2.8` | 19.2.8 | 19.2.8 |
| Drizzle ORM | `^0.45.2` | 0.45.2 | 0.45.2 |
| PostgreSQL driver | `pg ^8.23.0` | 8.23.0 | 8.23.0 |
| **sharp** | **не е в `package.json`** | **0.35.3** (optional dep на `next`) | **да, инсталира се** |
| libvips | — | 8.18.3 (вграден в sharp) | същият |
| PGlite | `^0.5.5` | 0.5.5 | инсталира се, **не се използва** |
| jose (сесии) | `^6.1.0` | 6.2.9 | |
| zod | `^4.4.3` | 4.4.3 | |
| motion | `^12.23.24` | 12.43.0 | само клиентски |
| lucide-react | `^0.548.0` | 0.548.0 | icons |
| qrcode | `^1.5.4` | 1.5.4 | SVG, без Buffer |

**Библиотеки за изображения:** само `sharp` — и той **не се използва от кода на
проекта**. `grep` за `sharp` в `src/` и `scripts/` не дава нито един резултат.
Единственият потребител е самият Next.js image оптимизатор. Няма отделна
resize/compress стъпка при качване.

**Storage:** няма SDK. `STORAGE_PROVIDER=local` → запис директно през
`node:fs/promises` върху монтирания Render диск. S3 адаптерът е нарочно
неимплементиран (`src/lib/storage.ts:100-114`).

**Email:** без библиотека — `fetch` към Resend HTTP API
(`src/lib/email/provider.ts:60-105`). SMTP адаптерът е неимплементиран.

**Analytics / monitoring / APM:** **никакви.** Няма Sentry, OpenTelemetry,
`instrumentation.ts`, нито каквъв и да е external agent. Това е добре за паметта
и лошо за диагностиката — оттук идва липсата на данни (раздел 15).

### Build и start команди

От `package.json`:

```
build : next build
start : next start
lint  : eslint .
test  : vitest run
```

От `render.yaml`:

```
buildCommand     : npm ci && npm run db:migrate && npm run build
preDeployCommand : npm run db:migrate && npm run db:seed && npm run db:verify
startCommand     : npm start          →  next start
healthCheckPath  : /contacts
```

### Стартира ли production правилно?

**Да — проверено.** `startCommand: npm start` → `next start` → истински
production сървър. Няма `next dev`, няма watcher, няма build процес в runtime.
Косвени потвърждения:

* `output` не е `standalone` (по подразбиране) — `next start` е правилният
  вариант за Render Web Service с монтиран диск, защото `public/` се чете от
  диска при заявка.
* Локалният тест със `next start` показа **един единствен процес** (probe-ът
  записа 605 и 298 семпъла, всичките с един pid) — Next 16 не форква render
  workers в production. Значи цялата памет е в един процес и целият лимит от
  512 MB е за него.
* Билдът маркира **всеки** маршрут като `ƒ (Dynamic)` освен `/_not-found` и
  `/robots.txt`.

### Конфигурационни файлове

| Файл | Наличен | Забележка |
|---|---|---|
| `package.json` | да | виж горе |
| `package-lock.json` | да | lockfileVersion валиден, `npm ci` минава |
| `next.config.ts` | да | пълно съдържание по-долу |
| `render.yaml` | да | plan `starter` (512 MB), `basic-256mb` за базата |
| `Dockerfile` | **не** | Render използва native Node runtime |
| `.node-version` | **не** | версията идва от `NODE_VERSION=22` |
| `.nvmrc` | **не** | |
| `instrumentation.ts` | **не** | — това е причината да няма runtime данни |
| `middleware.ts` / `proxy.ts` | **не** | нула middleware overhead |

`next.config.ts` (пълно, без тайни — файлът не съдържа такива):

```ts
serverExternalPackages: ["@electric-sql/pglite", "pg"],
experimental: { serverActions: { bodySizeLimit: "12mb" } },
images: {
  formats: ["image/avif", "image/webp"],
  dangerouslyAllowSVG: true,
  contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox; style-src 'unsafe-inline';",
},
```

**Липсват (и точно те са важни за паметта):** `cacheMaxMemorySize`,
`images.minimumCacheTTL`, `images.deviceSizes`/`imageSizes` (свити), както и
`NODE_OPTIONS` в `render.yaml`.

### Database и storage архитектура

Един споделен Drizzle instance над `pg.Pool`, разрешаван лениво през `Proxy`
и закачен на `globalThis` (`src/db/client.ts:28-95`). В разработка вместо това
се ползва вградена PGlite. Снимките се пишат на монтиран Render диск от 1 GB на
`/opt/render/project/src/public/uploads`, а базата съдържа само пътища.
Подробности в раздели 6 и 7.

Ефективна конфигурация на средата в Render (само имена — стойности не се
показват): `DATABASE_URL`, `SESSION_SECRET`, `SESSION_TTL_HOURS`, `APP_URL`,
`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `OWNER_NOTIFICATION_EMAIL`,
`EMAIL_PROVIDER`, `EMAIL_FROM`, `EMAIL_API_KEY`, `STORAGE_PROVIDER`,
`STORAGE_LOCAL_DIR`, `STORAGE_PUBLIC_PREFIX`, `ECONT_*` (14 променливи),
`NODE_VERSION`. **`UPLOAD_MAX_FILE_MB` и `UPLOAD_MAX_FILES` не са зададени в
`render.yaml`** → в продукция важат кодовите подразбирания 6 MB / 5 файла.

---

## 3. Verification Results

| Проверка | Команда | Резултат | Кратко |
|---|---|---|---|
| Инсталация от lock файла | `npm ci` | **PASS** | 463 пакета; предупреждения `EBADENGINE` само от локалния Node 21 (Render е на 22 — там няма да ги има) |
| Lint | `npm run lint` | **PASS** | нула съобщения |
| TypeScript typecheck | `npm run typecheck` | **PASS** | нула грешки |
| Unit / integration тестове | `npm test` | **PASS** | 11 файла, **196 теста**, 24,4 s |
| Production build | `npm run build` | **PASS** | компилация 31,3 s; всички маршрути `ƒ Dynamic` |
| Production dependency audit | `npm audit --omit=dev` | **FAIL** | **1 critical (`next`), 1 high (`sharp`)** — виж 4.1 |
| Пълен audit (вкл. dev) | `npm audit` | **FAIL** | 10: 1 critical, 3 high, 6 moderate |
| Дублирани production версии | анализ на `package-lock.json` | **PASS** | 0 пакета с повече от една версия |
| Circular dependencies | — | **BLOCKED** | няма `madge` / `dpdm` / `dependency-cruiser` в devDependencies; няма и npm script. Не съм добавял инструмент, защото това променя `package.json`. |
| Production source maps | проверка на defaults | **PASS** | `productionBrowserSourceMaps: false`; `experimental.serverSourceMaps` не е зададен → server source maps не се вдигат в паметта |
| Dev tooling в production | преглед на `dependencies` | **PASS** | нищо dev-only не е в prod групата |
| Локален production memory тест | `next start` + probe | **ИЗПЪЛНЕН** | раздел 9 |
| Тест срещу production / production база | — | **НЕ Е ИЗПЪЛНЕН** | по изрично ограничение |

Забележка за прозрачност: първият опит за image sweep беше **невалиден** — Git
Bash преобразуваше `/demo/...` в `C:/Program Files/Git/demo/...` при подаване
като argv, всички 672 заявки връщаха `400 "url" parameter is invalid` и не
вършеха работа. Открих го, защото фазата отне секунди вместо минути и дисковият
кеш остана празен. Числата в раздел 9 са от повторното, валидно изпълнение
(224 + 448 успешни оптимизации, потвърдени по HTTP 200 и реален AVIF magic
header `ftypavif`).

---

## 4. Confirmed Problems

### 4.1 — Critical RCE в Next.js Image Optimization API точно по AVIF пътя

* **Severity:** Critical
* **Confidence:** 100 % (публично advisory, версията съвпада)
* **Файл:** `package.json:31` (`"next": "^16.3.1"`), инсталирано 16.3.1;
  задейства се от `next.config.ts:16` (`formats: ["image/avif", "image/webp"]`)
* **Route:** `/_next/image` — публичен, неаутентикиран
* **Какво прави:** проектът работи на Next 16.3.1 и **изрично включва AVIF като
  първи формат**.
* **Защо е проблем:** `npm audit --omit=dev` докладва
  `GHSA-2xp9-vwfh-vxw4` — *„Next.js: Unauthenticated Remote Code Execution in
  Image Optimization API when AVIF files are used"*, засегнат диапазон
  `16.0.0 – 16.3.2`. Второ critical за същия диапазон:
  `GHSA-p293-qw3h-jr36` (RCE на Windows-хостнати сървъри — Render е Linux, така
  че то не важи). Отделно `sharp <0.35.4` е **high** (`GHSA-rgj7-g3m4-5g8c`,
  уязвимости в libheif).
* **Как се доказва:**
  ```
  next  16.0.0 - 16.3.2   Severity: critical
    Unauthenticated Remote Code Execution in Image Optimization API when AVIF files are used
  sharp <0.35.4           Severity: high
  ```
  Инсталираните версии са `next 16.3.1` и `sharp 0.35.3` — и двете в обхвата.
* **Поправка (не е приложена):** `next` → `16.3.3` или по-нова (налична е
  `16.3.4`), `sharp` → `0.35.4` или по-нова. Това е **и** най-безопасната първа
  промяна по памет, защото 16.3.3+ съдържа корекции точно по AVIF пътя.
* **Връзка с OOM:** същият код път, който е уязвим, е и най-скъпият по памет.
  Не твърдя, че сривовете са резултат от експлойт — няма данни за това — но
  комбинацията „публичен, скъп, уязвим" го прави приоритет №1.

### 4.2 — `caches.streets`: неограничен `Map` с ключове от непроверен вход

* **Severity:** High
* **Confidence:** 95 % (за неограничеността), ~25 % (че допринася за
  конкретните сривове)
* **Файл:** `src/lib/econt/nomenclatures.ts:20` (декларация), `:56-77`
  (`getStreets`), `:181-185` (`clearNomenclatureCache`)
* **Route:** `GET /api/econt/lookup?kind=streets&cityId=<N>`
  (`src/app/api/econt/lookup/route.ts:64-72`)
* **Какво прави кодът:**
  ```ts
  const caches = { …, streets: new Map<number, CacheEntry<string[]>>() };   // :20

  export async function getStreets(cityId: number): Promise<string[]> {
    const cached = fresh(caches.streets.get(cityId));
    if (cached) return cached;
    const response = await econtCall(…, { cityID: cityId });
    …
    caches.streets.set(cityId, { value: streets, expiresAt: Date.now() + TTL_MS });  // :72
  }
  ```
* **Защо задържа RAM:** `Map`-ът няма нито таван на размера, нито eviction, нито
  sweep. `expiresAt` прави записа *негоден*, но **не го премахва** — `fresh()`
  връща `null` и `set()` го презаписва. Ключът `cityId` идва директно от
  query string-а: `route.ts:48-53` валидира само „цяло положително число" —
  няма проверка, че градът съществува. Всяко различно число създава постоянен
  запис, включително `[]` за несъществуващ град. `clearNomenclatureCache()`
  съществува, но се вика само от ръчен админ екшън.
* **Как се доказва:** пуснах 40 заявки с `cityId=1..40` (произволни числа, не
  идващи от номенклатурата) срещу локалния production сървър — **всичките 40
  върнаха HTTP 200**, значи всичките 40 създадоха запис в `Map`-а. Rate limit-ът
  е 60/минута на IP (`route.ts:20-23`), тоест ~86 400 записа на ден на един IP,
  без горна граница във времето. Тежестта на запис е малка (~150 B), но растежът
  е монотонен до рестарт — **това е единственият истински неограничен растеж в
  кодовата база**.
* **Поправка (не е приложена):** три допълващи стъпки в
  `src/lib/econt/nomenclatures.ts` — (1) валидирай `cityId` срещу `getCities()`
  преди `getStreets` да пише в кеша; (2) сложи таван на `Map`-а (LRU с ~300
  записа); (3) премахвай изтеклите записи при `fresh()` вместо да ги оставяш.

### 4.3 — `getCities()` буферира 17 MB JSON при всяко изтичане на TTL, от публичен endpoint

* **Severity:** High
* **Confidence:** 85 %
* **Файлове:**
  * `src/lib/econt/client.ts:109` — `const text = await response.text();`
  * `src/lib/econt/client.ts:120` — `payload = text ? JSON.parse(text) : {};`
  * `src/lib/econt/nomenclatures.ts:15` — `const TTL_MS = 60 * 60 * 1000;`
  * `src/lib/econt/nomenclatures.ts:28-40` — `getCities()`
* **Route:** `GET /api/econt/lookup?kind=cities&q=…` — **публичен,
  неаутентикиран**, извикван от `DeliveryPicker` при всяко въвеждане в полето за
  град.
* **Какво прави:** зарежда цялата номенклатура на Еконт наведнъж и я държи в
  паметта един час, за да може `searchCities` да фильтрира локално.
* **Защо използва много RAM:** тялото на отговора е **17,21 MB / 18 041 001
  знака / 5 488 града**, всеки с вложени обекти (`location`, `monday`…`sunday`,
  `expressCityDeliveries`). `response.text()` държи едновременно суровите
  байтове *и* JS низа; `JSON.parse` добавя обектния граф.
* **Как се доказва — измерено директно (едно обръщение към **demo** API, не към
  production):**
  ```
  == getCities
     HTTP 200 | raw body: 17.21 MB (18 041 001 знака) | cities: array of 5488
     heapUsed    3.7 →  41.7 (след .text()) →  50.6 MB (след parse)
     arrayBuffers 0.0 → 35.3 →  0.0 MB
     rss         39.1 → 124.4 (пик) →  96.9 MB
  == getOffices
     raw body: 1.57 MB | offices: array of 586        ← пренебрежимо
  ```
  Изолирано измерване на *задържаното*: `heapUsed` 2,9 → **15,7 MB** докато
  кешът държи списъка, и обратно до 5,8 MB щом кешът се изчисти → **~12,8 MB
  задържани за един час, при ~85 MB преходен пик за едно обръщение.**

  Същото се вижда и през самото приложение — в първото измерване една заявка
  `?kind=cities` вдигна сървъра от `RSS 288,2 MB` на `RSS 375,3 MB`
  (`heapUsed` 49,6 → 95,4; `arrayBuffers` 8,1 → 42,9), а след успокояване RSS
  остана на 303,5 MB, тоест **+15 MB не се върнаха дори след два принудителни
  GC**.
* **Защо това има значение точно при 512 MB:** пикът е ~85 MB за **едно**
  обръщение. TTL-ът е един час, значи всеки час първият клиент, който отвори
  доставката, плаща пълната цена отново. Две-три едновременни заявки при
  студен кеш (напр. няколко посетители наведнъж, или бот) са +170…255 MB върху
  ~150 MB база. Няма нито mutex, нито single-flight — паралелните обръщения не
  се дедупликират и всяко буферира собствените си 17 MB.
* **Поправка (не е приложена):** в `src/lib/econt/nomenclatures.ts` —
  (1) не пази целия обект: сведи всеки град до `{id, name, postCode,
  regionName}` **преди** да го кешираш (изхвърля ~90 % от обема);
  (2) добави single-flight (пази `Promise`-а, не резултата), за да не текат
  паралелни 17 MB тегления; (3) вдигни TTL от 1 час на 24 часа —
  номенклатурата на Еконт се мени рядко; (4) по-добро: премести търсенето на
  градове в PostgreSQL таблица, попълвана от `scripts/`, и махни изцяло
  in-memory списъка.

### 4.4 — Image оптимизаторът изгражда плато от native памет, което не се връща

* **Severity:** High
* **Confidence:** 88 % (за самото плато — измерено), 72 % (че то е основната
  причина за сривовете в Render)
* **Файлове:**
  * `next.config.ts:16` — `formats: ["image/avif", "image/webp"]`
  * `next.config.ts` — **липсва** `images.minimumCacheTTL`, `deviceSizes`,
    `imageSizes`, `experimental.imgOptConcurrency`,
    `experimental.imgOptOperationCache`
  * `render.yaml` — **липсва** `NODE_OPTIONS`
  * (за контекст) `node_modules/next/dist/server/image-optimizer.js:219-226`
* **Route:** `/_next/image` — публичен, неаутентикиран
* **Какво прави кодът:** всяка снимка на сайта минава през `next/image`
  (12 употреби в 12 файла). AVIF е първи в списъка, значи всеки съвременен
  браузър и всеки бот с `Accept: image/avif` получава AVIF. Проектът не прави
  никакво собствено преоразмеряване — sharp работи върху **оригинала**, както
  е качен.
* **Защо задържа RAM — три отделни механизма:**
  1. **libvips operation cache остава включен.** Next вика `sharp.cache()` само
     ако `experimental.imgOptOperationCache` е boolean; по подразбиране е `null`
     → викът не се прави → остава фабричното `{memory: max 50 MB, files: 20,
     items: 100}`. Това са до 50 MB native памет, задържани безсрочно.
     Измерено: `sharp.cache()` → `{"memory":{"max":50},"files":{"max":20},"items":{"max":100}}`.
  2. **Конкурентността се изчислява от ядрата на *хоста*, не от лимита на
     контейнера.** `image-optimizer.js:221-226` прави
     `sharp.concurrency(cpus / 2)`. На Render `os.cpus().length` връща ядрата на
     физическата машина, а не 0,5 CPU от плана. Всяка libvips нишка има свой
     memory pool.
  3. **Allocator-ът не връща паметта на ОС.** Това е и най-ясно измеримото.
* **Как се доказва — локален production сървър, probe на всяка секунда**
  (`external ≈ 200,7 MB` е WASM heap-ът на PGlite, който в продукция не
  съществува; гледай делтите):
  ```
  етап                          RSS    heapUsed  external  arrayBuffers
  база (след GC)              287,5      47,9     200,7        8,1
  webp sweep (112 кодирания)  пик 340,8  50,5     205,2       11,4
  след GC                     321,4      49,6     200,7        8,1   ← +33,9 MB не се връщат
  avif sweep (112 кодирания)  пик 391,8  51,3     207,6       14,1
  след GC                     341,6      49,5     200,7        8,1   ← още +20,2 MB
  кеширан replay (112 HIT)    пик 342,5  51,1     203,1       10,4   ← нула ръст
  8-паралелен AVIF burst      пик 480,2  51,0     207,8       14,1
  след GC                     359,5      49,7     200,7        8,1   ← още +17,9 MB
  ```
  Разчитането е недвусмислено: `heapUsed` стои на ~50 MB, `external` и
  `arrayBuffers` се връщат **точно** на 200,7 / 8,1 — значи Node е освободил
  всичко — а `RSS` въпреки това расте с 72 MB. Освободена, но невърната на ОС
  памет: libvips + allocator, не задържани JS обекти.

  Пиковете са това, което убива 512 MB кутия:
  ```
  пик при последователна AVIF оптимизация :  391,8 MB  (≈ 191 MB без PGlite)
  пик при 8 паралелни AVIF заявки         :  480,2 MB  (≈ 280 MB без PGlite)
  ```
  Отделно, директно измерване на sharp върху реалистично големи снимки (какви
  клиент качва от телефон — качването **не ограничава размерите**):
  ```
  sharp 0.35.3 / libvips 8.18.3 | подразбираща се concurrency: 6
  4 паралелни AVIF кодирания на 24 MP снимка → ПИК RSS 291,9 MB (от база 75,4 MB)
  едно AVIF кодиране на 1200×900 → 3,1 s на пълноценно десктоп ядро
  ```
* **Допълнително наблюдение с практическо значение:** 1200×900 AVIF отнема
  **3,1 s** на пълно ядро. При **0,5 CPU** това е порядъка на 8–25 s, а
  вграденият таймаут на оптимизатора е `imgOptTimeoutInSeconds = 7`. Тоест на
  Render голяма част от AVIF оптимизациите **изтичат по време — след като вече
  са заделили паметта**, клиентът/ботът повтаря, и се получава самоусилващ се
  цикъл. Това обяснява и защо CPU графиката изглежда ~0: работата е на пристъпи
  и се осреднява в минутните бъкети, а сървърът повечето време чака.
* **Ограничение на този тест:** измерванията са на Windows. Linux/glibc се
  фрагментира по друг начин — при много нишки и разнородни размери типично
  **по-зле**, не по-добре. Заключението се пренася, но точните числа не.
* **Как да се поправи (не е приложено):**
  * `next.config.ts` — свий `images` конфигурацията: махни `"image/avif"` (само
    `["image/webp"]`), вдигни `minimumCacheTTL` от 4 h на 30 дни, свий
    `deviceSizes` до реално използваните ~4 стойности, добави
    `experimental.imgOptOperationCache: false` и
    `experimental.imgOptConcurrency: 1`.
  * `render.yaml` — добави `NODE_OPTIONS=--max-old-space-size=<~70 % от плана>`.
  * Нов код в `src/lib/storage.ts` — преоразмерявай при качване до ~2000 px по
    дългата страна и изхвърляй оригинала. Това е истинската поправка: тя маха
    големия вход, вместо да го оптимизира скъпо при всяка заявка.

### 4.5 — `pg.Pool` без `error` listener: един мъртъв idle client събаря процеса

* **Severity:** High
* **Confidence:** 90 %
* **Файл:** `src/db/client.ts:36-46`
* **Функция:** `createDatabase()`
* **Какво прави:**
  ```ts
  const pool = globalThis.__cbePool ?? new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
    ssl: … ,
  });
  ```
* **Защо е проблем:** `pg.Pool` е `EventEmitter` и емитва `'error'`, когато
  **idle** client умре — рестарт на базата от Render, изтекъл TCP idle, network
  blip. `grep` за `pool.on`, `on("error"`, `unhandledRejection`,
  `uncaughtException` в целия `src/` и `scripts/` не дава **нито един**
  резултат. `EventEmitter` без listener за `'error'` хвърля като uncaught
  exception → Node процесът пада.
* **Как се доказва:** `grep -rn "pool.on\|on('error'\|unhandledRejection\|uncaughtException" src scripts` → празно.
* **Защо е важно за диагностиката:** това е **втори, независим начин процесът да
  умира**, който в Render Events може да изглежда като OOM, ако не е погледнат
  точният лог. Ако част от сривовете идват оттук, никакво вдигане на паметта
  няма да ги спре. Затова раздел 15 иска изрично разграничаване по логове.
* **Поправка (не е приложена):** в `src/db/client.ts`, веднага след `new Pool`
  — `pool.on("error", (err) => console.error("pg pool idle client error:", err.message))`;
  плюс `idleTimeoutMillis` и `connectionTimeoutMillis`. По желание и
  `process.on("unhandledRejection", …)`.

### 4.6 — `void pruneSessions()` и `after(work)` могат да породят unhandled rejection

* **Severity:** Medium
* **Confidence:** 70 %
* **Файлове:**
  * `src/app/admin/(panel)/layout.tsx:26` — `void pruneSessions();`
  * `src/server/orders/service.ts:326` + `:449-456` — `scheduleAfterResponse(...)`
* **Какво прави:** `pruneSessions()` е fire-and-forget без `.catch()`. При
  `scheduleAfterResponse` Promise-ът се създава **преди** `after()` да го
  регистрира (`await import("next/server")` е между двете), тоест ако работата
  се провали в този интервал, отхвърлянето остава необработено.
* **Защо е проблем:** Node ≥15 прекратява процеса при unhandled rejection по
  подразбиране. Всяко зареждане на админ панела, докато базата не отговаря,
  може да събори сървъра.
* **Как се доказва:** `layout.tsx:26` — `void` без `.catch`; `service.ts:449-456`
  — `after(work)` след `await import`.
* **Поправка (не е приложена):** `void pruneSessions().catch(…)` в
  `src/app/admin/(panel)/layout.tsx`; в `src/server/orders/service.ts` направи
  `scheduleAfterResponse` да приема функция вместо готов Promise.

### 4.7 — `render.yaml` без `NODE_OPTIONS`: V8 мисли, че разполага с 4 GB

* **Severity:** High
* **Confidence:** 80 %
* **Файл:** `render.yaml`, блок `envVars` (има само `NODE_VERSION`)
* **Какво липсва:** `NODE_OPTIONS=--max-old-space-size=…`
* **Защо е проблем:** Node не чете cgroup memory лимита при оразмеряване на
  heap-а — той го изчислява от паметта на хоста. На одитната машина
  (15 741 MB RAM) измерих `heap_size_limit = 4 144 MB`. На Render машината
  числото ще е от същия порядък, докато контейнерът има **512 MB**. Следствие:
  V8 никога не изпитва натиск, никога не прави агресивен full GC и оставя
  heap-а да расте, докато **cgroup killer-ът го убие първи**. Точно това
  произвежда наблюдавания профил — плавно покачване до 450–500 MB и внезапна
  смърт, без CPU шип и без грешка в приложението.
* **Как се доказва:** `render.yaml` няма `NODE_OPTIONS`; локално
  `require("v8").getHeapStatistics().heap_size_limit` = 4 144 MB при 15,7 GB
  системна памет.
* **Поправка (не е приложена):** `render.yaml` → `NODE_OPTIONS` с
  `--max-old-space-size` на ~70 % от плана (при 512 MB план: `--max-old-space-size=350`).
  Ефектът е двоен: V8 започва да GC-ва навреме, а ако все пак прекали, получаваш
  чист `heap out of memory` stack trace вместо мълчаливо убиване — тоест **и
  диагностика**.

### 4.8 — Всяко health check обръщение прави пълен render и 7 заявки към базата

* **Severity:** Medium
* **Confidence:** 95 %
* **Файлове:**
  * `render.yaml` → `healthCheckPath: /contacts`
  * `src/app/(site)/contacts/page.tsx:18` — `export const dynamic = "force-dynamic"`
  * `src/app/(site)/contacts/page.tsx:21` — `getSettings()` в `generateMetadata`
  * `src/app/(site)/contacts/page.tsx:35-39` — `getSettings`, `getWorkingHours`, `getUpcomingExceptions`
  * `src/app/(site)/layout.tsx:15` + `:22-26` — пак `getSettings`, `getWorkingHours`, `getActiveAnnouncement`
* **Какво прави:** Render пинга `/contacts`. Маршрутът е `force-dynamic`, значи
  нищо не се кешира. `getSettings()` се вика **три пъти** на заявка (metadata,
  page, layout), `getWorkingHours()` — два пъти. Няма `React.cache()`, което би
  дедупликирало в рамките на един render.
* **Защо е важно:** обяснява 17 419 заявки за 7 дни. Това е ~104/час ≈
  1 заявка на 35 s — почти точно интервалът на health check. **Основната част от
  „трафика" вероятно е самият health check, а не посетители.** Извод за
  диагностиката: сривовете не се обясняват с органичен трафик, а с малко на
  брой скъпи заявки.
* **Поправка (не е приложена):** обвий query-тата в `src/server/queries/settings.ts`
  с `React.cache()` (дедупликация в рамките на заявка); направи отделен лек
  `healthCheckPath` (напр. `/robots.txt`, който е статичен, или нов
  `/api/health`, който не пипа базата).

---

## 5. Suspected Problems

### 5.1 — Оригиналните снимки на Render може да са прекалено големи

* **Severity:** High, ако се потвърди
* **Confidence:** 55 %
* **Файлове:** `src/lib/storage.ts:145-182` (`storeUploadedImage`),
  `src/lib/env.ts:86-87` (`UPLOAD_MAX_FILE_MB` 6, `UPLOAD_MAX_FILES` 5)
* **Основание:** `storeUploadedImage` валидира само **размера във байтове** и
  magic bytes (`sniffImageType`, `src/lib/validation.ts:235-240`) и записва
  оригинала непокътнат. **Никъде няма проверка за пиксели.** Междувременно
  вграденият таван на оптимизатора е `imgOptMaxInputPixels = 268 402 689`
  (~268 мегапиксела). 6 MB JPEG от телефон е спокойно 24 MP → 96 MB суров RGBA
  за декодиране.
* **Локалните демо снимки са безобидни** — измерих всичките 28: 1200×900 или
  900×1100, 4,1 MB суров декод. Затова платото в раздел 9 е **долна граница**;
  с реални клиентски снимки ще е по-високо.
* **Какво липсва за потвърждение:** разпределението на размерите (в пиксели) на
  файловете в `/opt/render/project/src/public/uploads`. Точна команда за Render
  Shell в раздел 15.

### 5.2 — Rate-limit `Map` расте с потребителски контролирани ключове

* **Severity:** Low
* **Confidence:** 60 % за механизма, ~5 % че допринася
* **Файл:** `src/lib/rate-limit.ts:12` (`const buckets = new Map(...)`),
  `:16-22` (`sweep`), `src/server/auth/session.ts:59-62`
* **Основание:** ключовете включват IP (`clientKey`, `:66-73`) и **имейла от
  формата за вход** (`login:acct:${normalizedEmail}`) — тоест произволен
  потребителски вход. `sweep()` върши работа, но само (а) веднъж на 60 s и (б)
  **само когато някой извика `rateLimit()`**. Ако трафикът спре, записите
  остават до следващата заявка.
* Записът е ~150 B и sweep-ът реално чисти → приемам за **ограничен на
  практика**. Отбелязвам за пълнота, не като причина.
* **Какво липсва:** нищо; това може да се затвори по код review, без данни.

### 5.3 — Заявки без `LIMIT`, които днес са безобидни

* **Severity:** Low
* **Confidence:** 90 % за наличието, ~5 % че допринася днес
* **Файлове:**
  * `src/server/queries/catalog.ts:137-144` — `listPublicProducts()` без `limit`, когато не е подаден
  * `src/server/queries/catalog.ts:191-197` — `listAdminProducts()`
  * `src/server/queries/catalog.ts:26-57` — `listPublicCategories()` тегли **всички product id-та** и брои в JS, вместо `COUNT(*)` в SQL
  * `src/server/queries/gallery.ts:38-54` — `listAdminGallery()`
  * `src/server/queries/gallery.ts:70-102` — `listImageLibrary()`
  * `src/app/admin/(panel)/layout.tsx:28-31` — тегли всички `NEW` поръчки, за да ги преброи
  * `src/app/sitemap.ts:21-24` — целият каталог, `force-dynamic`
* **Основание:** каталогът на бутикова сладкарница е десетки редове, така че
  днес това е незначително. **Поръчките са правилно страницирани**
  (`src/server/queries/orders.ts:42-110`, `pageSize` ≤ 100), а `getOrder`
  и `getCalendarOrders` са ограничени по id/дата — тоест единствената таблица,
  която расте безкрайно, е под контрол. Отбелязвам, защото галерията и
  каталогът ще растат.
* **N+1:** няма истински N+1 — `attachMedia` (`catalog.ts:81-118`) прави точно
  2 заявки за произволен брой продукти. Добра реализация.

### 5.4 — `UPLOAD_MAX_FILES × UPLOAD_MAX_FILE_MB` надхвърля `bodySizeLimit`

* **Severity:** Low
* **Confidence:** 85 %
* **Файлове:** `src/lib/env.ts:86-87` (6 MB × 5 файла = **30 MB**) срещу
  `next.config.ts:12` (`bodySizeLimit: "12mb"`)
* **Основание:** клиент, който приложи 5 снимки по 5 MB, ще получи непонятна
  грешка за размер на тялото, вместо дружелюбното съобщение от
  `src/server/orders/actions.ts:124-128`. Освен това Next буферира **цялото**
  multipart тяло в паметта, преди server action-ът да се стартира — до 12 MB на
  паралелна заявка, без глобален лимит на конкурентността. Самите файлове се
  обработват **последователно** (`actions.ts:140-141` — `for … await`), което е
  правилно.
* **Какво липсва:** брой едновременни качвания в production (в момента няма
  логване, което да го покаже).

### 5.5 — Дублирани `getSettings()` / `getWorkingHours()` при всеки render

* **Severity:** Low (ефективност, не памет)
* **Confidence:** 100 % за наличието
* **Файлове:** `src/app/(site)/layout.tsx:22-26` и `src/app/(site)/page.tsx:45-52`
  (и същият модел в `contacts`, `menu`, `gallery`, `order`)
* **Основание:** `React.cache()` не се използва никъде, а всички маршрути са
  `force-dynamic`. Началната страница прави ~11 заявки, от които 2-3 са
  дубликати. При `max: 10` в pool-а и 0,5 CPU това е чиста латентност.

---

## 6. Database Connection Audit

### Всички места, в които се създава client / pool / Drizzle instance

Изчерпателно — `grep` за `new Pool`, `new Client`, `new PGlite`, `drizzle(`,
`drizzleNode`, `drizzlePglite` в `src/`, `scripts/`, `tests/`, `drizzle.config.ts`:

| Файл:ред | Какво | Оценка |
|---|---|---|
| `src/db/client.ts:38` | `new Pool({ connectionString, max: 10, ssl })` | единственият production pool |
| `src/db/client.ts:46` | `drizzleNode(pool, { schema })` | обвивка над същия pool |
| `src/db/client.ts:59` | `new PGlite(dir)` | **само** когато `DATABASE_URL` е празен → dev/CI |
| `src/db/client.ts:62` | `drizzlePglite(client, { schema })` | dev/CI |

**Няма нито едно друго място.** Нула създавания на client в route handler, server
action, компонент или на import time.

### Има ли singleton?

**Да, коректен, на две нива.**

```ts
declare global { var __cbeDb; var __cbePool; var __cbePglite; }               // :28-32
const pool = globalThis.__cbePool ?? new Pool({...}); globalThis.__cbePool = pool;  // :36-45
function resolveDatabase() { if (globalThis.__cbeDb) return it; … }           // :65-72
export const db = new Proxy({} as Database, { get(...) {...} });              // :83-95
```

Две неща тук са направени добре и заслужават да бъдат отбелязани:

1. **`globalThis`, а не module scope.** Оцелява HMR и повторното оценяване на
   модули, което е класическият източник на „нов pool при всеки hot reload".
2. **`Proxy`, който отлага резолюцията до първата истинска заявка.** Коментарът
   на `:74-82` е точен: `next build` пуска няколко worker процеса, които
   import-ват server модули без да заявяват. Без този Proxy всеки worker щеше да
   отваря pool (или, по-лошо, single-writer PGlite директория).

Един нюанс: `Proxy.get` вика `resolveDatabase()` при **всеки** достъп до
свойство и прави `value.bind(instance)` за всеки метод, тоест заделя нова
функция на всяко `db.select(...)`. Това е краткотраен обект, който GC събира
веднага — не е leak, но при много заявки е ненужен boilerplate. Не е фактор.

### Настройки и рискове

| Настройка | Стойност | Оценка |
|---|---|---|
| `max` | 10 | безопасно за `basic-256mb`; един процес × 10 връзки |
| `idleTimeoutMillis` | не е зададен → 10 000 ms (`pg` default) | приемливо |
| `connectionTimeoutMillis` | не е зададен → без таймаут | **риск**: заявка може да чака вечно за връзка |
| `ssl` | `rejectUnauthorized: false`, само при `sslmode=require` в URL-а | работи с Render; не проверява сертификата |
| `pool.on("error")` | **липсва** | **виж 4.5 — може да събори процеса** |
| `statement_timeout` / `query_timeout` | не са зададени | заклещена заявка държи връзка и памет неопределено |
| `allowExitOnIdle` | не е зададен | без значение за дълго живеещ сървър |

### Незатворени transactions, cursors, streams, connections

* **Transactions:** `grep` за `db.transaction` → използва се от Drizzle callback
  API, който винаги прави `COMMIT`/`ROLLBACK` и връща client-а в pool-а.
  Не намерих ръчни `BEGIN`/`COMMIT`.
* **Cursors / streams:** нула. Няма `pg-cursor`, няма `pg-query-stream`, няма
  `QueryStream`. Всяка заявка е буферирана — при малките резултати тук е
  правилният избор.
* **Ръчни `pool.connect()`:** нула → няма забравен `client.release()`.

### Заключение

**Слоят за връзка с базата е чист и не е причина за OOM.** Един споделен pool,
таван 10 връзки, нула leaked client-и, правилно страницирани заявки към
единствената растяща таблица (`orders`). Двата реални дефекта тук —
липсващият `error` listener (4.5) и липсващият `connectionTimeoutMillis` — са
**рискове за стабилност, не за памет**, но първият е достатъчно сериозен, за да
може да е причина за *част* от сривовете, и затова е P0 в плана.

---

## 7. Image and Upload Audit

### Всички image / upload маршрути и библиотеки

| Път | Тип | Автентикация | Какво прави |
|---|---|---|---|
| `/_next/image` | вграден Next handler | **не** | sharp: декод + resize + AVIF/WebP енкод |
| `/uploads/*` | статичен Next handler | **не** | стриймва файл от монтирания диск |
| `/demo/*` | статичен Next handler | **не** | стриймва файл от билда |
| `POST /order` (server action) | `src/server/orders/actions.ts:121-141` | не (публично) | до 5 файла × 6 MB, референтни снимки |
| server action `saveCategory` | `src/server/admin/catalog.ts:76` | админ | 1 снимка |
| server action `saveProduct` | `src/server/admin/catalog.ts:389-393` | админ | N снимки |
| server action галерия | `src/server/admin/site.ts:392-404` | админ | N снимки |

Библиотеки: **само `sharp` 0.35.3 / libvips 8.18.3**, и той се използва
изключително от Next. Кодът на проекта не import-ва sharp никъде. `qrcode`
генерира SVG низ, не растер (`src/app/admin/print/[id]/page.tsx:51-54`) — нула
Buffer.

### Размери и лимити

| Лимит | Стойност | Къде |
|---|---|---|
Макс. размер на файл | **6 MB** (default; таван 25) | `src/lib/env.ts:86` |
| Макс. брой файлове | **5** (default; таван 20) | `src/lib/env.ts:87` |
| Макс. тяло на server action | **12 MB** | `next.config.ts:12` |
| Разрешени типове | JPEG / PNG / WebP, **по magic bytes** | `src/lib/storage.ts:132-136`, `src/lib/validation.ts:235-240` |
| **Макс. пиксели при качване** | **НЯМА** | — |
| Макс. пиксели при оптимизация | 268 402 689 (~268 MP), Next default | `imgOptMaxInputPixels` |
| Разрешени `w` | 15 стойности (8 device + 7 image), Next default | — |
| Разрешени `q` | **само 75** | Next 16 default `qualities: [75]` |
| Таймаут на оптимизация | 7 s | `imgOptTimeoutInSeconds` |
| `minimumCacheTTL` | **4 часа** (Next default, не е override-нат) | — |

Валидацията при качване е направена стриктно и правилно: магически байтове
вместо декларирано MIME, име винаги свеж UUID, разширението се избира от
разпознатия тип — крafted име не може ни да излезе от директорията, ни да си
избере разширение (`src/lib/storage.ts:56-58`, `:138-143`, `:192-194`).
**Единствената липсваща проверка е за размери в пиксели.**

### Buffer / stream поведение

* `src/lib/storage.ts:163` — `const bytes = new Uint8Array(await file.arrayBuffer());`
  Целият файл влиза в паметта наведнъж. При 6 MB таван това е приемливо; при
  25 MB (горна граница на env схемата) вече не е.
* `src/lib/storage.ts:68` — `await fs.writeFile(target, bytes)`. Един запис,
  без stream. **Няма нито един `createReadStream` / `createWriteStream` в
  проекта** → няма как да останат отворени stream-ове.
* `src/server/orders/actions.ts:140-141` — `for (const file of files) { await storeUploadedImage(...) }`
  → **последователно**. Няма fan-out на едновременни декодирания в една заявка.
  Правилно.
* Buffer-ите не се задържат след заявката: `storeUploadedImage` връща само
  метаданни (`url`, `key`, `mimeType`, `sizeBytes`), а `bytes` излиза от scope.
  Няма глобален масив/`Map`, в който да попадат.
* `src/lib/econt/client.ts:72-75` — `Buffer.from(...).toString("base64")` за
  Basic auth. Няколко байта.
* `src/server/auth/session.ts:247-248` — `Buffer.from(a/b)` за `timingSafeEqual`.
  Няколко байта.
* Временни файлове: нула. Няма `os.tmpdir()`, няма `mkdtemp`.

### `next/image` и sharp

* 12 употреби в 12 файла; **всяка** е с `fill` **и** коректен `sizes`
  (проверих всички) → браузърът иска само нужната ширина, няма разсипничество.
* **Ботовете не могат да генерират безкрайно много варианти** — проверено на
  живо: `q=100` → `400`, `w=999` → `400`. Next 16 приема само `qualities: [75]`
  и белия списък от `deviceSizes`/`imageSizes`. Максималното пространство от
  варианти е `брой снимки × 15 ширини × 2 формата`, което за днешния каталог е
  ~840 — ограничено и кешируемо. **Това е сериозен аргумент *срещу* хипотезата
  „bot amplification по варианти".**
* Дисковият кеш **работи** — проверено: първа заявка `X-Nextjs-Cache: MISS`,
  всяка следваща `HIT`; 112 записа / 3 069 KB в `.next/cache/images`; replay на
  всичките 112 варианта даде 112/112 HIT и **нула** ръст на паметта.
  Таванът е 50 % от свободното дисково пространство (`maxDiskSize`
  е `undefined` → `statfs`-базиран) — тук 88 GB, тоест без натиск за eviction.
* **НО:** кешът е на **ефемерната** файлова система на контейнера, не на
  монтирания диск. Всеки деплой и всеки рестарт го изтрива → след всеки OOM
  всичко се прекодира отначало. Плюс `minimumCacheTTL` = 4 h означава, че
  **същите снимки се прекодират наново на всеки 4 часа, безкрайно.** Това е
  ключово за формата на графиката: периодични вълни от скъпо native заделяне.
* `sharp.cache()` остава на фабричното `{memory: 50 MB, files: 20, items: 100}`,
  защото `imgOptOperationCache` е `null` → до 50 MB native, задържани безсрочно.
* `sharp.concurrency()` се задава на `os.cpus().length / 2` — от ядрата на
  **хоста**, не от 0,5 CPU на плана.

### JavaScript heap срещу native / external памет

Това е най-важното разграничение в целия отчет и данните са категорични:

| Метрика | Поведение при 900+ image кодирания | Заключение |
|---|---|---|
| `heapUsed` | **49,7 MB, плосък** през целите 720 s | **нула задържани JS обекти** |
| `heapTotal` | 55,1 → 55,6 MB | V8 heap-ът дори не се разширява |
| `external` | 200,7 → 207,8 → **обратно точно 200,7** | Node освобождава всичко |
| `arrayBuffers` | 8,1 → 14,1 → **обратно точно 8,1** | нула задържани буфери |
| `RSS` | 287,5 → 359,5, плато на ~348 | **native/allocator задържане** |

Тоест: **проблемът е изцяло от native страна (libvips + allocator), нула от
страна на JavaScript.** Оттук следва и практически извод — heap snapshot-и и
`--inspect` профилиране **няма да покажат нищо**; трябва да се гледат RSS и
`external`, и да се меси конфигурацията на sharp, не JS кодът.

### Заключение

Кодът за качване е написан внимателно и не тече. Рискът е концентриран в две
неща, и двете конфигурационни, не логически:

1. **Липсва преоразмеряване при качване.** Оригиналът се пази както е дошъл,
   без таван на пикселите, и после се декодира наново при всяка заявка към
   `/_next/image` след изтичане на 4-часовия TTL. Това е единичната промяна с
   най-голям ефект върху паметта.
2. **AVIF е включен на кутия с 0,5 CPU.** Измерено: 3,1 s за 1200×900 на пълно
   ядро, при таймаут от 7 s и половин ядро. Скъпо, често изтича по време, и
   всяко изпълнение оставя следа в RSS, която не се връща.

---

## 8. Cache and Global State Audit

Изчерпателен списък на всяко изменяемо глобално състояние в кодовата база.

| # | Файл:ред | Какво | Ключове | Таван | Eviction | Lifecycle | Риск |
|---|---|---|---|---|---|---|---|
| 1 | `src/lib/econt/nomenclatures.ts:18` | `caches.cities` | — (единичен) | — | TTL 1 h, замяна | процес | **~13 MB задържани + ~85 MB пик на презареждане** |
| 2 | `src/lib/econt/nomenclatures.ts:19` | `caches.offices` | — (единичен) | — | TTL 1 h, замяна | процес | ~1,5 MB payload, малко |
| 3 | `src/lib/econt/nomenclatures.ts:20` | `caches.streets` | **`cityId` от query string** | **НЯМА** | **НЯМА** (изтеклите не се трият) | процес | **неограничен растеж** |
| 4 | `src/lib/rate-limit.ts:12` | `buckets` | IP + **имейл от формата** | няма | `sweep()` на 60 s, само при заявка | процес | нисък |
| 5 | `src/lib/rate-limit.ts:14` | `lastSweep` | скалар | — | — | процес | няма |
| 6 | `src/lib/storage.ts:116` | `adapter` | единичен обект | — | — | процес | няма |
| 7 | `src/lib/email/provider.ts:122` | `adapter` | единичен обект | — | — | процес | няма |
| 8 | `src/db/client.ts:29-31` | `__cbeDb`, `__cbePool`, `__cbePglite` | единични | — | — | процес | няма (виж 6) |
| 9 | `src/lib/env.ts:103` | `env` | замразен обект | — | — | процес | няма |

**Нищо друго.** Няма session store в паметта, няма in-memory queue, няма
глобален масив или обект, в който да попадат responses, database objects,
users, orders, products или изображения. Проверено с `grep` за `new Map`,
`new Set`, глобални `let`/`const` контейнери — списъкът горе е пълен.

### Next.js кеширане

| Механизъм | Състояние | Ефект |
|---|---|---|
| `cacheMaxMemorySize` | не е зададен → **50 MB** default | таван; на практика **неизползван** (виж по-долу) |
| `"use cache"` | **не се използва никъде** | — |
| `unstable_cache` | **не се използва никъде** | — |
| `React.cache` | **не се използва никъде** | → дублирани заявки (5.5) |
| `revalidate` / ISR | **не се използва** | — |
| Full Route Cache | **изключен на практика** — `dynamic = "force-dynamic"` на всичките 27 маршрута | нула кеширан HTML в RAM |
| `revalidatePath` | 12 употреби в `src/server/admin/*` | само инвалидация, не пълни памет |
| Custom cache handler | няма | — |
| `fetch` кеш | `cache: "no-store"` в Еконт client-а (`src/lib/econt/client.ts:92`) | нищо не влиза в Data Cache |
| Image disk cache | `.next/cache/images`, работи, ефемерен | виж 7 |

### Динамични cache keys с неограничен брой стойности

Само един: **`caches.streets` по `cityId`** (ред 3 в таблицата). Всичко останало
е или единичен обект, или самопочистващо се.

### Може ли Next.js кешът по подразбиране да обясни покачването?

**Не, и това е важно за фокусирането.** Три независими аргумента:

1. **Всичките 27 маршрута са `force-dynamic`** → нула кеширан HTML/RSC в
   паметта. Билдът потвърждава: всичко е `ƒ (Dynamic)`.
2. **Data Cache е практически празен** — няма `use cache`, няма
   `unstable_cache`, а единственият `fetch` към външна услуга е `no-store`.
   `cacheMaxMemorySize` от 50 MB е таван на нещо, което не се пълни.
3. **Измерено:** 140 page render-а (7 маршрута × 20) вдигнаха `heapUsed` до
   72,3 MB и след GC той се върна на 47,9 MB — **пълно възстановяване**, RSS
   също се върна (330,5 → 287,5). Page render-ването не оставя следа.

Изводът е полезен: **не си губете времето с `cacheMaxMemorySize: 0`** като
първа мярка (все пак е в раздел 13 като контролен тест, защото е нула-риск и
евтино изключва хипотезата окончателно). Растежът е в `/_next/image` и
в Еконт номенклатурата.

### Заключение

Глобалното състояние е малко, преброимо и в почти цялата си част коректно.
Един истински неограничен растеж (`caches.streets`), един голям и подценен
кеш (`caches.cities` — 17 MB payload за ~13 MB задържани), и нищо друго.
Next.js кешът е изключен от само себе си и е изключен като хипотеза.

---

## 9. Runtime Memory Test

**Възможен ли беше тестът?** Да. `DATABASE_URL` е **празен** в `.env.local`, а
`STORAGE_PROVIDER=local`, `EMAIL_PROVIDER=console`, `ECONT_ENVIRONMENT=demo` →
локалната среда е напълно непроизводствена. Нула production credentials.
`db:migrate`/`db:seed` не бяха пускани (базата `.data/pglite`, 41 MB, вече е
seed-ната).

**Метод:** `npm run build`, после `next start -p 3100` под
`node --expose-gc --require <scratchpad>/probe.cjs`. Probe-ът записва
`process.memoryUsage()` + `uptime` + активни handles всяка секунда в JSONL
**извън** проекта; source кодът не е пипан. Един процес (потвърдено:
всичките семпли с един pid). Concurrency ≤ 8, само локално.

> **Задължителна поправка при разчитането:** локално се използва PGlite, чийто
> WASM heap заема **~200,7 MB `external`** — константа, която в продукция
> **не съществува** (там е `pg`, чийто import струва ~7 MB — измерено).
> Затова важни са **делтите**, а „Next-съотносимо" = `RSS − 200,7 MB`.

### 9.1 Основна поредица

| Етап / endpoint | Локални заявки | RSS | heapUsed | heapTotal | external | arrayBuffers | Възстановява ли се |
|---|---|---|---|---|---|---|---|
| `00` база (при старт) | 0 | 330,2 | 39,0 | 57,3 | 200,8 | 8,1 | — |
| `01` страници: `/`, `/menu`, `/gallery`, `/contacts`, `/order`, `/privacy`, `/sitemap.xml` × 20 | 140 | пик **330,5** | пик 72,3 | 92,6 | 203,4 | 10,8 | **да, напълно** |
| `03` след принудителен GC | — | **287,5** | 47,9 | 55,1 | 200,7 | 8,1 | ✅ база |
| `04–05` `/_next/image` **WebP** (28 снимки × 4 ширини) | 112 | пик **340,8** | 50,5 | 54,9 | 205,2 | 11,4 | частично |
| `06` след GC | — | **321,4** | 49,6 | 54,9 | 200,7 | 8,1 | ❌ **+33,9 MB остават** |
| `07–08` `/_next/image` **AVIF** (28 × 4) | 112 | пик **391,8** | 51,3 | 55,4 | 207,6 | 14,1 | частично |
| `09` след GC | — | **341,6** | 49,5 | 55,4 | 200,7 | 8,1 | ❌ **още +20,2 MB** |
| `10–11` кеширан replay (112/112 `X-Nextjs-Cache: HIT`) | 112 | пик 342,5 | 51,1 | 55,4 | 203,1 | 10,4 | **да** — нула ръст |
| `12–13` **8-паралелен AVIF burst** (28 × 3) | 84 | пик **480,2** | 51,0 | 55,4 | 207,8 | 14,1 | частично |
| `14` след GC | — | **359,5** | 49,7 | 55,4 | 200,7 | 8,1 | ❌ **още +17,9 MB** |
| `15` бездействие 15 s | 0 | 358,7 | 49,7 | 55,4 | 200,7 | 8,1 | не |

### 9.2 Повтарящо се прекодиране — тестът за „расте ли безкрайно"

Симулира 4-часовия `minimumCacheTTL`: изтривам `.next/cache/images` и пускам
пълния AVIF sweep отново, четири пъти.

| Кръг | Кодирания | Време | RSS след GC | heapUsed | external | arrayBuffers |
|---|---|---|---|---|---|---|
| R1 | 112 | 76 s | 350,8 (пик 399,1) | 49,7 | 200,7 | 8,1 |
| R2 | 112 | 82 s | **326,0** (пик 404,2) | 49,7 | 200,7 | 8,1 |
| R3 | 112 | 78 s | 326,1 (пик 399,8) | 49,7 | 200,7 | 8,1 |
| R4 | 112 | 88 s | 348,8 (пик 399,2) | 49,7 | 200,7 | 8,1 |
| бездействие 20 s | — | — | 348,2 | 49,8 | 200,7 | 8,1 |

**Разчитане:** още 448 кодирания **не покачиха** платото — RSS осцилира
326–359 MB, всеки кръг пикира на ~400 MB. Значи **растежът е ограничен и
достига плато, не е неограничен leak.** `heapUsed` е закотвен на 49,7 MB през
цялото време (720 s, 900+ кодирания).

### 9.3 Еконт lookup (от първата поредица; отделно и директно измерване)

| Етап | Заявки | RSS | heapUsed | external | arrayBuffers | Възстановява ли се |
|---|---|---|---|---|---|---|
| преди Еконт (след GC) | 0 | 288,2 | 49,6 | 200,7 | 8,1 | — |
| `?kind=cities` | **1** | **375,3** (пик 380,8) | **95,4** | **235,5** | **42,9** | частично |
| `?kind=offices` | 1 | 375,7 | 95,8 | 235,5 | 42,9 | — |
| `?kind=streets` × 40 различни `cityId` | 40 | 311,0 | 62,8 | 200,8 | 8,2 | — |
| финално бездействие + 2× GC | — | **303,5** | 61,5 | 200,7 | 8,1 | ❌ **+15 MB остават** |

Директно, в изолиран Node процес (по едно обръщение към **demo** API):

| Стъпка | RSS | heapUsed | external | arrayBuffers |
|---|---|---|---|---|
| база | 39,2 | 2,9 | 1,4 | 0,0 |
| след `response.text()` (17,21 MB тяло) | **124,4** | 42,4 | 40,6 | **37,0** |
| след `JSON.parse` (5 488 града) | 96,9 | 50,1 | 3,7 | 0,0 |
| **задържано само от кеша** (междинните пуснати, 2× GC) | **62,4** | **15,7** | — | — |
| след `cache = null` + GC | 54,5 | 5,8 | — | — |

### 9.4 sharp, директно (изолиран процес)

```
sharp 0.35.3 | libvips 8.18.3 | подразбираща се concurrency: 6 | os.cpus(): 6
sharp.cache(): {"memory":{"max":50},"files":{"max":20},"items":{"max":100}}   ← Next не го изключва

1200×900   → AVIF :  3 100 ms   (при таймаут на Next от 7 s и 0,5 CPU в Render)
1200×900   → WebP :    263 ms
4000×3000  → AVIF :  4 752 ms
6000×4000  → AVIF :  3 175 ms,  единично: RSS 69,5 → 64,1 (стриймва добре)
4× паралелно 6000×4000 → AVIF :  **ПИК RSS 291,9 MB** от база 75,4 MB  (+216 MB)
```

### 9.5 Какво расте и връща ли се паметта

| Ос | Расте ли | Връща ли се | Заключение |
|---|---|---|---|
| `heapUsed` | **не** — 49,7 MB, неизменно | н/п | **няма JS leak** |
| `heapTotal` | не (55,1 → 55,6) | н/п | V8 heap-ът дори не се разширява |
| `external` | само преходно | **да, точно до 200,7** | Node освобождава всичко |
| `arrayBuffers` | само преходно (до 42,9 при Еконт) | **да, точно до 8,1** | нула задържани буфери |
| `RSS` | **да, +72 MB, после плато** | **не** | **native/allocator задържане** |
| активни handles | не (1–3 през целия тест) | — | нула leak на handles/sockets |

**Възстановява ли се паметта след GC / изчакване?** JS heap-ът — да, напълно и
многократно. RSS — не. Два принудителни `global.gc()` след всяка фаза и
20 s бездействие не върнаха нито един от трите ratchet-а.

### 9.6 Съотнасяне към production числата

| Величина | Локално измерено | Изваден PGlite (~200,7 MB) | Наблюдавано в Render |
|---|---|---|---|
| RSS в покой след старт | 287,5 MB | **~87 MB** | 120–190 MB ✅ |
| RSS плато след натоварване | 348–359 MB | **~148–159 MB** | — |
| Пик, последователен AVIF | 391,8 MB | ~191 MB | — |
| Пик, 8-паралелен AVIF | 480,2 MB | **~280 MB** | 450–500 MB преди срив ✅ |

Двете независими съвпадения — базата (~87–148 MB срещу наблюдаваните
120–190 MB) и пиковете — са силен аргумент, че локалният модел възпроизвежда
production поведението, въпреки разликата в базата данни и операционната
система.

### 9.7 Ограничения на този тест

1. **Windows, не Linux/glibc.** Фрагментацията при glibc с много нишки и
   разнородни размери типично е **по-лоша**. Числата не се пренасят буквално;
   посоката — да.
2. **PGlite вместо PostgreSQL.** Скрива истинската база и добавя 200 MB
   `external`. Затова навсякъде работя с делти.
3. **Демо снимките са малки** (1200×900). Платото е **долна граница**; с реални
   клиентски снимки без ограничение на пикселите ще е по-високо (5.1).
4. **Еконт demo API, не production.** Обемът на номенклатурата в production
   най-вероятно е същият или по-голям.
5. **Локално има пълноценен CPU.** В Render 0,5 CPU разтяга всяко AVIF
   кодиране ~10× и увеличава броя едновременни заявки в опашка — тоест
   реалните пикове там са **по-високи**, не по-ниски.
6. **Не са тествани server actions с качване на файлове** — за целта би
   трябвало да запиша файлове в `public/uploads`, което ограничението „само
   отчетът да се създава" забранява.
7. **Тестът е с продължителност 12 минути, не дни.** Плато за 720 s не
   изключва много бавен растеж — оттам и инструментацията в раздел 11.

---

## 10. Route Risk Ranking

От най-рисков към най-безопасен, по консумация на RAM за заявка:

| # | Маршрут | Автент. | Риск | Защо |
|---|---|---|---|---|
| **1** | `GET /_next/image` | **не** | **Критичен** | sharp декод + AVIF енкод на оригинал без таван на пикселите; конкурентността е от ядрата на хоста; libvips operation cache 50 MB не се изключва; измерен пик **480 MB** при 8 паралелни; прекодира наново на всеки 4 h; **и** носи critical RCE advisory (4.1) |
| **2** | `GET /api/econt/lookup?kind=cities` | **не** | **Критичен** | 17,21 MB тяло / 5 488 града; **+85 MB преходно за едно обръщение**, ~13 MB задържани за час; без single-flight, паралелните заявки се умножават |
| **3** | `GET /api/econt/lookup?kind=streets` | **не** | **Висок** | единственият истински неограничен растеж — `Map` без таван, ключ от непроверен `cityId` (4.2) |
| **4** | `GET /api/econt/lookup?kind=offices` | **не** | Среден | 1,57 MB тяло, 586 офиса; същият модел, ~10× по-малък |
| **5** | `POST /order` (server action) | **не** | Среден | Next буферира цялото multipart тяло — до 12 MB на паралелна заявка, без глобален лимит; вътре обработката е последователна (добре) |
| **6** | server actions на `/admin/products`, `/admin/gallery`, `/admin/categories` | админ | Среден | N файла × 6 MB през същия път; плюс `listAdminProducts` / `listAdminGallery` без `LIMIT` |
| **7** | `GET /sitemap.xml` | **не** | Среден | целият каталог, `force-dynamic`, нула кеш; главната цел на всеки краулър; води ботовете към #1 |
| **8** | `GET /` | **не** | Нисък-среден | ~11 заявки (2-3 дубликати), 8 `<Image>` → до 8 обръщения към #1 на посещение |
| **9** | `GET /menu/[category]/[product]` | **не** | Нисък-среден | 10 продуктови страници в sitemap-а; 2 изображения всяка |
| **10** | `GET /gallery` | **не** | Нисък-среден | най-много изображения на страница → най-много обръщения към #1 |
| **11** | `GET /menu`, `/menu/[category]` | **не** | Нисък | малки заявки + изображения |
| **12** | `GET /admin/*` (панел) | админ | Нисък | защитен; `layout` тегли всички `NEW` поръчки без `LIMIT` |
| **13** | `GET /admin/print/[id]` | админ | Нисък | самостоятелна защита (`page.tsx:39-40`); **но** `generateMetadata:22-28` чете от базата **преди** проверката → неаутентикирана заявка към произволен UUID прави DB четене |
| **14** | `GET /contacts` | **не** | Нисък, **но постоянен** | health check път; 7 заявки × ~1 700 пъти на ден; вероятно основната част от 17 419 заявки |
| **15** | `GET /order-summary/[token]` | токен | Нисък | 20–64 знака непредположим токен; една заявка |
| **16** | `GET /order` | **не** | Нисък | конфигураторът е клиентски; сървърът дава само данни |
| **17** | `GET /admin/login` | **не** | Нисък | rate-limit по IP и по акаунт |
| **18** | `GET /privacy` | **не** | Много нисък | само настройки |
| **19** | `GET /robots.txt` | **не** | Нищожен | статичен (`○` в билда) |

### Bot amplification — конкретна оценка

| Вектор | Възможен ли е | Оценка |
|---|---|---|
| `/_next/image` с произволно `q` | **НЕ** | проверено: `q=100` → `400`; Next 16 приема само `qualities: [75]` |
| `/_next/image` с произволно `w` | **НЕ** | проверено: `w=999` → `400`; само белият списък от 15 ширини |
| `/_next/image` с произволно `url` | **НЕ** | само локални пътища и `remotePatterns` (празен) |
| **`/_next/image` с паралелни заявки към валидни варианти** | **ДА** | **основният вектор**; таванът на вариантите не пречи, защото проблемът е конкурентността и 4-часовият TTL, не броят различни ключове |
| `/api/econt/lookup?kind=streets&cityId=<произволно>` | **ДА** | 60/мин на IP; всяко число създава постоянен запис |
| `/api/econt/lookup?kind=cities` при студен кеш | **ДА** | 60/мин на IP; всяко обръщение при празен кеш е 17 MB |
| `/sitemap.xml` → продуктови страници → изображения | **ДА** | нормално краулерско поведение, не атака |

`robots.txt` (`src/app/robots.ts:5-18`) забранява `/admin`, `/order-summary/`,
`/api/` — тоест **благонамерените** ботове няма да пипат Еконт endpoint-а. Но:
`/_next/image` **не е** в `disallow` (и не бива да е, иначе Google не вижда
снимките), а злонамерените ботове не четат `robots.txt`.

**17 419 заявки за 7 дни ≠ 17 419 посетители.** Разбивка по оценка:
~1 700/ден health check към `/contacts` (≈ 12 000 за 7 дни, 69 %), плюс
краулери, плюс истински посетители — при които **едно** посещение на началната
страница означава 1 HTML + до 8 обръщения към `/_next/image`. Тоест реалните
човешки посещения вероятно са от порядъка на **стотици**, а не хиляди.

---

## 11. Recommended Diagnostic Instrumentation

Проектът **няма** `instrumentation.ts` — това е причината да няма runtime данни
и оттам да не може да се посочи една причина с пълна сигурност. Следният файл
е минималният, който би затворил въпроса. **Не съм го създал** — това е предложение.

Създайте `src/instrumentation.ts` (Next го зарежда автоматично, веднъж, в
server процеса):

```ts
/**
 * Диагностично логване на паметта. Само броячи — нула лични данни, нула тайни.
 * Активира се със `MEMLOG=1`, за да може да се пуска и спира без деплой на код.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.MEMLOG !== "1") return;

  const MB = (b: number) => Math.round(b / 1048576);
  const started = Date.now();
  let peakRss = 0;

  const tick = () => {
    const m = process.memoryUsage();
    if (m.rss > peakRss) peakRss = m.rss;

    // Групиране на активните ресурси по вид — само имена на типове,
    // никакви адреси, URL-и или payload-и.
    const byType: Record<string, number> = {};
    for (const kind of process.getActiveResourcesInfo()) {
      byType[kind] = (byType[kind] ?? 0) + 1;
    }

    console.log(
      JSON.stringify({
        tag: "MEM",
        uptimeS: Math.round(process.uptime()),
        sinceBootS: Math.round((Date.now() - started) / 1000),
        rssMB: MB(m.rss),
        peakRssMB: MB(peakRss),
        heapTotalMB: MB(m.heapTotal),
        heapUsedMB: MB(m.heapUsed),
        externalMB: MB(m.external),
        arrayBuffersMB: MB(m.arrayBuffers),
        heapLimitMB: MB(require("node:v8").getHeapStatistics().heap_size_limit),
        resources: byType,
      }),
    );
  };

  tick();
  const timer = setInterval(tick, 60_000);
  timer.unref(); // никога не задържа процеса жив
}
```

Как се използва:

1. Добавете `MEMLOG=1` в Render Environment (без деплой на код се вдига само
   ако файлът вече е там — затова файлът влиза с първия P1 деплой).
2. В Render Logs филтрирайте по `"tag":"MEM"`.
3. Ключът за разчитане:

| Наблюдение | Означава |
|---|---|
| `heapUsedMB` расте монотонно между рестартите | **истински JS leak** — тогава правете heap snapshot |
| `heapUsedMB` плосък, `rssMB` расте | **native/фрагментация** — sharp/libvips (потвърждава раздел 9) |
| `externalMB` / `arrayBuffersMB` шипват | буферирани отговори — Еконт (4.3) или качване |
| `rssMB` расте само след AVIF трафик | потвърждава 4.4 |
| `heapLimitMB` ≫ 512 | потвърждава 4.7 — V8 не знае за лимита |
| `resources` расте безкрайно | leak на handles/sockets/timers (локално **не** наблюдаван) |

**Незадължително, но полезно:** същият `console.log` в `catch` блока на
`src/lib/econt/nomenclatures.ts`, който при всяко истинско презареждане на
номенклатурата да пише `{"tag":"ECONT_RELOAD","citiesCount":n}` — така се вижда
колко често се плаща 17 MB цената.

**Какво да НЕ добавяте:** APM agent (Sentry/OTel) на 512 MB кутия — добавя
30–60 MB резидентна памет и ще замъгли точно това, което мерите. Първо
затворете причината, после мислете за APM, и то на 1 GB.

---

## 12. Recommended Fix Plan

Нищо от изброеното **не е приложено**. За всяка стъпка са посочени точните
файлове.

### P0 — спиране на сривовете (същия ден, минимален риск)

| # | Действие | Файлове | Защо |
|---|---|---|---|
| P0-1 | Вдигни плана на **1 GB** | Render Dashboard (не файл) | измерените пикове са ~280 MB Next-съотносимо; 1 GB дава реален резерв и печели време за истинските корекции. Признавам: маскира, не поправя. |
| P0-2 | Добави `NODE_OPTIONS=--max-old-space-size=700` (при 1 GB) | `render.yaml`, блок `envVars` | V8 започва да GC-ва навреме вместо да чака cgroup killer-а; при все пак изчерпване получаваш `heap out of memory` **със stack trace** вместо мълчалива смърт |
| P0-3 | Обнови `next` → ≥ 16.3.3 и `sharp` → ≥ 0.35.4 | `package.json`, `package-lock.json` | затваря **critical** RCE точно по AVIF пътя (4.1) и **high** в libvips; поправките са и по паметта |
| P0-4 | Добави `pool.on("error", …)` + `connectionTimeoutMillis` | `src/db/client.ts` (след ред 44) | премахва независим начин процесът да умира (4.5) |
| P0-5 | Пусни диагностичната инструментация | нов `src/instrumentation.ts` + `MEMLOG=1` | без нея следващият срив пак няма да е обясним |

### P1 — истинските корекции на причината

| # | Действие | Файлове | Очакван ефект |
|---|---|---|---|
| P1-1 | **Преоразмерявай при качване** — макс. ~2000 px по дългата страна, изхвърляй оригинала; сложи и таван на пикселите преди декодиране | `src/lib/storage.ts` (`storeUploadedImage`, ~ред 163), нова зависимост `sharp` в `dependencies` | **най-голям единичен ефект.** Маха скъпия вход веднъж завинаги, вместо да го оптимизира при всяка заявка |
| P1-2 | Изключи AVIF; вдигни `minimumCacheTTL`; свий `deviceSizes`; ограничи sharp | `next.config.ts` (блок `images` + `experimental`) | 3,1 s → 0,26 s за кодиране (измерено, ~12×); маха таймаутите при 0,5 CPU; `imgOptOperationCache: false` маха 50 MB native кеш; `imgOptConcurrency: 1` премахва пика от 480 MB |
| P1-3 | **Поправи `caches.streets`** — валидирай `cityId` срещу `getCities()`, сложи LRU таван (~300), трий изтеклите записи | `src/lib/econt/nomenclatures.ts:20`, `:56-77`; `src/app/api/econt/lookup/route.ts:64-72` | затваря единствения истински неограничен растеж (4.2) |
| P1-4 | **Свий и защити `caches.cities`** — проектирай всеки град до `{id, name, postCode, regionName}` преди кеширане; single-flight; TTL 1 h → 24 h | `src/lib/econt/nomenclatures.ts:15`, `:28-40`, `:42-54` | ~13 MB → ~1,5 MB задържани; премахва умножаването на 17 MB при паралелни заявки (4.3) |
| P1-5 | Направи `minimumCacheTTL` дълъг **и** премести image кеша на монтирания диск (или сложи Render CDN пред сайта) | `next.config.ts`; `render.yaml` (`disk.mountPath`) | кешът да преживява рестарт и деплой; днес всеки OOM изтрива всичко и започва наново |
| P1-6 | `.catch()` на fire-and-forget работата | `src/app/admin/(panel)/layout.tsx:26`; `src/server/orders/service.ts:449-456` | премахва път до unhandled rejection (4.6) |
| P1-7 | Съгласувай upload лимитите: `UPLOAD_MAX_FILES × UPLOAD_MAX_FILE_MB` ≤ `bodySizeLimit` | `render.yaml` (`envVars`) или `next.config.ts:12` | ясна грешка вместо непонятна (5.4) |

### P2 — оптимизации и мониторинг

| # | Действие | Файлове |
|---|---|---|
| P2-1 | Обвий query-тата с `React.cache()` — маха 2-3 дублирани заявки на render | `src/server/queries/settings.ts`, `src/server/queries/catalog.ts` |
| P2-2 | Отделен лек `healthCheckPath` (`/api/health`, без база) вместо `/contacts` | нов route + `render.yaml` |
| P2-3 | `COUNT(*)` в SQL вместо теглене на всички id-та | `src/server/queries/catalog.ts:37-49`; `src/app/admin/(panel)/layout.tsx:28-31` |
| P2-4 | `LIMIT` + странициране в админ списъците | `src/server/queries/catalog.ts:191`, `src/server/queries/gallery.ts:38`, `:70` |
| P2-5 | Кеширай `/sitemap.xml` (махни `force-dynamic`, сложи `revalidate`) | `src/app/sitemap.ts:6` |
| P2-6 | Провери автентикацията **преди** DB четенето в `generateMetadata` | `src/app/admin/print/[id]/page.tsx:22-28` |
| P2-7 | Премести PGlite в `devDependencies` — 25 MB мъртъв товар в production (WASM не се инстанцира, така че **не** е memory проблем; измерено: import струва ~1 MB) | `package.json`, `src/db/client.ts:5-6` (динамичен import) |
| P2-8 | Добави `madge` или `dpdm` за проверка на циклични зависимости — днес такава проверка е невъзможна | `package.json` (`devDependencies` + script) |
| P2-9 | Обмисли връщане на 512 MB **след** P1 и седмица чисти MEM логове | Render Dashboard |

---

## 13. Safe A/B Diagnostic Deploys

Всеки тест е **поотделно**, с поне 24 часа между тях, и с включен `MEMLOG=1`.
Правилото: **никога две промени наведнъж** — иначе не се разбира коя е
подействала.

### Тест A — `cacheMaxMemorySize: 0`

* **Промяна:** `next.config.ts` → `cacheMaxMemorySize: 0`
* **Хипотеза:** in-memory Next кешът пълни паметта
* **Потвърждава хипотезата:** `rssMB` расте видимо по-бавно или платото пада с
  десетки MB
* **Отхвърля хипотезата:** няма измерима разлика
* **Очакване от този одит: ще отхвърли.** Всичките 27 маршрута са
  `force-dynamic`, `use cache`/`unstable_cache` не се използват, единственият
  външен `fetch` е `no-store` → кешът е практически празен. Тестът остава в
  списъка, защото е нула-риск, обратим с един ред и **окончателно** изключва
  цяло семейство хипотези.
* **Риск:** нулев.

### Тест B — `images.unoptimized: true` (временно)

* **Промяна:** `next.config.ts` → `images: { unoptimized: true }`
* **Хипотеза:** image оптимизаторът е основният консуматор
* **Потвърждава:** `rssMB` спира да расте и остава близо до стойността при
  рестарт (120–190 MB); OOM изчезва напълно
* **Отхвърля:** RSS продължава да пълзи към 450 MB
* **Това е най-информативният единичен тест в списъка.** Изолира sharp напълно.
* **Риск:** визуален и по трафик — оригиналните снимки се сервират както са.
  Ако някоя е 6 MB, посетителите ще я теглят цялата. Пусни за **24–48 часа**,
  не за постоянно, и гледай изходящия трафик.
* **Ако този тест премахне сривовете, причината е потвърдена** и приоритет №1
  става P1-1 (преоразмеряване при качване), а не по-голям план.

### Тест B2 — само WebP (по-мека версия на B, препоръчвам преди B)

* **Промяна:** `next.config.ts` → `formats: ["image/webp"]`
* **Хипотеза:** конкретно AVIF енкодерът е скъпият
* **Потвърждава:** пиковете в `peakRssMB` изчезват или се свиват значително;
  сривовете спират
* **Отхвърля:** RSS расте както преди
* **Основание от измерванията:** 3 100 ms (AVIF) срещу 263 ms (WebP) за същата
  снимка — **11,8×**. При таймаут от 7 s и 0,5 CPU разликата е между „става" и
  „изтича по време, след като е заделило паметта".
* **Риск:** малко по-големи файлове за посетителя. Практически нула.

### Тест C — ограничаване на sharp

* **Промяна:** `next.config.ts` →
  ```ts
  experimental: {
    imgOptConcurrency: 1,        // една libvips нишка, не cpus/2 от ядрата на ХОСТА
    imgOptOperationCache: false, // изключва фабричния 50 MB native кеш на libvips
    imgOptSequentialRead: true,  // стриймва вместо да държи целия декод
  }
  ```
* **Хипотеза:** конкурентността и operation cache-ът на libvips изграждат платото
* **Потвърждава:** `peakRssMB` пада драстично (измерено локално: 480 MB при
  8 паралелни срещу 391 MB при последователни); платото се смъква
* **Отхвърля:** без разлика → значи виновникът е самият декод на големи
  оригинали, тогава P1-1 е задължителен
* **Риск:** оптимизациите стават по-бавни, при пик се редят на опашка. На
  0,5 CPU те и без това не са паралелни ефективно, така че цената е малка.
* **Забележка:** може да се комбинира с B2 — но **само след** като B2 е
  измерен самостоятелно.

### Тест D — ограничаване на Node heap (само диагностично)

* **Промяна:** `render.yaml` → `NODE_OPTIONS=--max-old-space-size=350` (при
  512 MB план)
* **Хипотеза:** V8 не GC-ва, защото вижда лимита на хоста (измерено локално:
  4 144 MB при 15,7 GB системна памет)
* **Потвърждава:** появяват се `FATAL ERROR: Reached heap limit — JavaScript
  heap out of memory` **със stack trace** вместо `Ran out of memory (used over
  512MB)`; stack trace-ът показва точното място
* **Отхвърля:** пак идва суровият cgroup OOM без stack trace → значи паметта е
  **native**, извън V8 heap-а, което **потвърждава** заключението на раздел 9
* **И двата резултата са информативни** — това е рядкост и затова тестът е
  ценен.
* **Риск:** сривовете може да станат **по-чести** (V8 се предава по-рано).
  Затова е диагностичен, за няколко часа, а не постоянна настройка. При 1 GB
  план стойността `700` е разумна за постоянно.

### Тест E — DB singleton / pool корекция

* **Промяна:** `src/db/client.ts` → `pool.on("error", …)`, `idleTimeoutMillis`,
  `connectionTimeoutMillis`
* **Хипотеза:** част от „сривовете" не са OOM, а падане на процеса от
  необработена `'error'` на pool-а при рестарт на базата
* **Потвърждава:** в лога се появява `pg pool idle client error: …` **без**
  процесът да умира; част от Events записите изчезват
* **Отхвърля:** нито едно такова събитие за седмица → всички сривове са
  наистина OOM
* **Този тест не е за памет — той разделя два различни вида смърт**, които в
  Render Events изглеждат еднакво. Затова е P0.
* **Риск:** нулев. Singleton-ът вече е коректен (раздел 6); това е само
  добавяне на listener.

### Тест F — upload size и concurrency лимити

* **Промяна:** `render.yaml` → `UPLOAD_MAX_FILE_MB=3`, `UPLOAD_MAX_FILES=3`
* **Хипотеза:** големите качвания предизвикват пиковете
* **Потвърждава:** пиковете в `peakRssMB` съвпадат по време с качвания и
  намаляват след промяната
* **Отхвърля:** пиковете идват в часове без никаква админ активност → значи са
  от `/_next/image` или Еконт
* **Разграничаващата стойност е висока:** качванията са редки и с ясен
  времеви отпечатък. Ако пиковете **не** са свързани с тях, това изключва цяло
  направление.
* **Риск:** клиентът може да не успее да качи снимка от нов телефон. Обяви го
  предварително; и без това P1-1 (преоразмеряване) го прави ненужно.

### Ред на изпълнение (препоръчан)

```
ден 0   P0-1..P0-5  (1 GB + NODE_OPTIONS + версии + pool listener + MEMLOG)
        → сривовете трябва да спрат. Сега има време за спокойно измерване.
ден 1   Тест A       → очаквано отхвърляне; изключва Next кеша окончателно
ден 2   Тест B2      → най-вероятният виновник, най-евтината проверка
ден 4   Тест C       → ако B2 е помогнал само частично
ден 6   Тест F       → разграничава качванията по време
ден 8   Тест B       → само ако горните не са дали ясен отговор
след    P1-1..P1-7 според резултатите; после P2; после евентуално 512 MB
```

---

## 14. Final Verdict

**Има ли проблем в кода?**
Да, но не такъв, какъвто предполага думата „leak". Кодът е написан внимателно —
196 теста минават, lint и typecheck са чисти, DB singleton-ът е коректен,
качванията са валидирани по магически байтове, поръчките са страницирани, няма
нито един server-side `setInterval`, `EventEmitter` или незатворен stream.
Реалните дефекти са **пет**, и повечето са конфигурационни:

1. `caches.streets` расте неограничено с ключове от непроверен потребителски
   вход — **единственият истински неограничен растеж** в кодовата база.
2. `getCities()` буферира 17,21 MB JSON от публичен endpoint, без single-flight,
   на всеки час.
3. Image оптимизаторът работи върху оригинали без таван на пикселите, с AVIF, на
   0,5 CPU, с конкурентност изчислена от ядрата на **хоста**.
4. `pg.Pool` е без `error` listener — процесът може да падне и без OOM.
5. `render.yaml` е без `NODE_OPTIONS`, така че V8 смята, че разполага с ~4 GB.

**Коя е най-вероятната причина?**
Комбинация, а не едно нещо — и това е важно, защото обяснява защо сривовете
идват в различни дни и часове без видима закономерност:

* **Основно (72 %):** платото от native памет, което sharp/libvips изгражда и
  не връща на ОС, плюс пиковете при конкурентна AVIF оптимизация. Измерено:
  +72 MB задържано RSS при плосък `heapUsed`, пик 480 MB при 8 паралелни заявки.
* **Съществено допълнение (85 %, че допринася):** ~85 MB преходен пик за едно
  обръщение към `/api/econt/lookup?kind=cities`, повтарящ се на всеки час.
* **Усилвател (80 %):** V8 вижда лимит от 4 GB вместо 512 MB и няма причина да
  GC-ва, докато cgroup killer-ът не се намеси.
* **Малък, но истински (95 %, че съществува):** неограниченият `Map` на улиците.

**Трите най-подозрителни файла/функции:**

| # | Файл | Функция / конфигурация |
|---|---|---|
| 1 | `next.config.ts:16` (+ липсващите `experimental.imgOpt*`) | `images.formats: ["image/avif", "image/webp"]` — задейства най-скъпия sharp път на 0,5 CPU, при `imgOptOperationCache: null` и concurrency от ядрата на хоста |
| 2 | `src/lib/econt/nomenclatures.ts:20`, `:28-40`, `:56-77` | `caches.streets` (неограничен `Map`) и `getCities()` (17 MB payload, TTL 1 h, без single-flight) |
| 3 | `src/lib/storage.ts:145-182` | `storeUploadedImage` — валидира байтове, **не** пиксели; пази оригинала без преоразмеряване, което после хранѝ #1 |

Почтено уточнение: `src/db/client.ts:36-46` не е в тройката по **памет**, но е
кандидат №1 за „срив, който изглежда като OOM, а не е" (4.5) — затова е P0.

**Какви данни още липсват?**

1. **Разпределението на размерите (в пиксели) на файловете в
   `/opt/render/project/src/public/uploads`.** Това е най-важната липсваща
   информация — определя дали 5.1 е High или несъществен.
2. **Runtime memory телеметрия от production.** Няма `instrumentation.ts`, няма
   APM → нула данни за това как `rssMB` спрямо `heapUsedMB` се движи между
   рестартите. Разделът, който би отговорил окончателно на „leak или плато".
3. **Точният текст в Render Logs непосредствено преди всеки OOM** — за да се
   раздели истинският cgroup OOM от падане по unhandled exception (4.5, 4.6).
4. **Дали `ECONT_USERNAME`/`ECONT_PASSWORD` са конфигурирани в production.** Ако
   не са, `/api/econt/lookup` връща 503 преди да пипне кеша и цялото
   направление 4.2/4.3 отпада.
5. **Разпределение на заявките по път** — потвърждение, че `/contacts` е ~70 %
   от 17 419 и колко от останалото е `/_next/image`.
6. **Броят рестарти и uptime между тях** — от 120–190 MB до 500 MB за колко
   часа? Наклонът различава „плато, което просто не се вписва в 512 MB" от
   „истински бавен leak".

**Каква е най-безопасната първа промяна?**
**`next` → ≥ 16.3.3 и `sharp` → ≥ 0.35.4** (P0-3). Нулев риск за поведението,
затваря critical RCE точно по AVIF пътя, и корекциите в 16.3.3 са именно по
този код път. Веднага след това, ако трябва да е една единствена промяна с
измерим ефект върху паметта: **`formats: ["image/webp"]`** в `next.config.ts` —
един ред, обратим, и по измерване 11,8× по-евтин на кодиране.

**Подходящ ли е 512 MB планът след поправката?**
**Да, най-вероятно — но само след P1-1 и P1-2.** С преоразмеряване при
качване (макс. ~2000 px), само WebP, `imgOptConcurrency: 1` и
`imgOptOperationCache: false` очаквам плато от порядъка на 150–220 MB и пикове
под 300 MB. Това се вписва в 512 MB със стеснен, но реален резерв. Преди тези
две поправки — не: измерените пикове (~280 MB Next-съотносимо при 8 паралелни
AVIF заявки, върху база 148 MB) са опасно близо до тавана и вече го пробиват.
Препоръчвам връщане на 512 MB **само** след една седмица чисти MEM логове
(P2-9).

**Ще прикрие ли 1 GB проблема?**
**Да — и точно това е причината да е P0, но не и край на работата.** Ще спре
сривовете почти сигурно (плато 148 MB + пик 280 MB се вписват удобно). Но
маскира три неща, които остават: неограниченият `Map` на улиците (при
достатъчно упорит бот пълни и 1 GB, само по-бавно), неограничената
конкурентност на image оптимизатора (тя расте с трафика, не с плана), и
липсващият `error` listener на pool-а (изобщо не е въпрос на памет). Използвайте
1 GB като време за спокойна работа, не като решение.

**Има ли риск за потребителски данни, поръчки или снимки при сривовете?**
**Не при самите OOM сривове.** Обосновка:

* **Поръчките са в PostgreSQL, не в паметта.** Създаването минава през
  транзакция; SIGKILL по време на транзакция води до `ROLLBACK` от страна на
  сървъра. Базата е `Available` и на 6,77 % от 1 GB — няма признак за проблем.
* **Снимките са на монтиран диск**, който преживява рестарт и деплой
  (`render.yaml`, `disk: uploads`). Записът е един `fs.writeFile`
  (`src/lib/storage.ts:68`), а не многостъпков.
* **Идемпотентността е обмислена:** `snapshotFingerprint`
  (`src/server/orders/service.ts:424-441`) разпознава двойно подаване, така че
  клиент, който презареди след срив и подаде отново, не създава дублирана
  поръчка.
* **`db:verify` в `preDeployCommand`** спира деплоя, ако базата е останала
  празна — Render запазва предишната версия вместо да пусне кух сайт.

Три реални, но по-малки риска, които трябва да се назоват:

1. **Загуба на имейл известия.** `after(work)`
   (`src/server/orders/service.ts:449-456`) изпраща писмата **след** отговора.
   SIGKILL в този прозорец означава: поръчката е записана, но собственикът не е
   известѐн. Тъй като `EMAIL_PROVIDER=resend` в `render.yaml`, това е реален
   сценарий — **поръчка може да бъде пропусната, без някой да разбере.** Ефектът
   е смекчен от таблицата `order_emails`, която пази опитите за доставка, така
   че липсата е откриваема в админа.
2. **Прекъснато качване.** Ако процесът умре по време на server action с
   файлове, част от файловете може да са на диска без ред в базата — orphan
   файлове, които заемат място. Няма загуба на данни, но няма и почистване.
3. **Изгубени незаписани редакции в админ панела** при срив по време на
   попълване на форма. Обичайно, не специфично за този проект.

Заключение по риска: **данните са в безопасност; известията не са напълно.**
Струва си след P1 да се добави повторен опит за изпращане на имейлите въз
основа на `order_emails`.

---

## 15. Information Needed From Render

Това, което следва, е точното, което ще затвори останалата несигурност.

### 15.1 Времеви прозорец за всеки OOM

За **всеки** от последните OOM-и (изгледайте поне 3, за да се види
закономерност) извадете:

* **`-15 минути` до `+2 минути`** около събитието от **Render → Logs**
  (не само Events). Пълен, нефилтриран лог за този прозорец.
* Точна **UTC** времева марка от **Render → Events** за реда
  `Ran out of memory (used over 512MB) while running your code`.
* **Uptime до срива** — от кой `Deploy live` / `Restarted` ред започва
  животът на процеса. Това дава наклона: от 120–190 MB до 500+ MB за колко часа?
  **Това е най-важното единично число, което липсва** — разграничава плато от
  бавен leak.

### 15.2 Кои log филтри да ползвате

По приоритет:

| Филтър | Търси |
|---|---|
| `Ran out of memory` | самите OOM събития (Events) |
| `heap out of memory` / `FATAL ERROR` / `Reached heap limit` | **V8** OOM със stack trace — ако го има, причината е JS heap, а не native (променя целия извод) |
| `Killed` / `SIGKILL` / `exit status 137` | cgroup OOM killer — суров, без stack trace → **native** памет |
| `/_next/image` | обем и групиране във времето на оптимизациите — **основната хипотеза** |
| `/api/econt/lookup` | обръщения към номенклатурата; групирайте по `kind=` |
| `econt` (case-insensitive) | `Econt lookup failed:` от `route.ts:77,83` |
| `error` / `Error:` / `at ` | необработени изключения (4.5, 4.6) |
| `pg` / `ECONNRESET` / `Connection terminated` | смърт на idle client в pool-а (4.5) |
| `Invalid` / `400` за `/_next/image` | опити на ботове за неразрешени `w`/`q` |
| `"tag":"MEM"` | след като инструментацията от раздел 11 е деплойната |

### 15.3 Кои endpoints и request patterns са важни

Разбивка **брой заявки по път** за 7 дни (не общо число). Конкретно:

1. **`/_next/image`** — брой; групиране във времето (има ли пристъпи?);
   разпределение по `w` и по `Accept` (колко са AVIF срещу WebP); дали
   пристъпите съвпадат по време с OOM-ите. **Това е тестът на хипотеза №1.**
2. **`/api/econt/lookup`** — брой, разбит по `kind=cities` / `offices` /
   `streets`; колко **различни** `cityId` стойности се срещат (много различни и
   несвързани числа = ботова активност срещу `caches.streets`); от колко
   различни IP-та.
3. **`/contacts`** — за потвърждение, че health check-ът е ~70 % от 17 419.
4. **`/sitemap.xml`** и продуктовите страници — краулерска активност.
5. **User-Agent разпределение** — колко от 17 419 са ботове. Очаквам мнозинство.
6. **Има ли пристъпи от едно IP** непосредствено преди сривовете.

### 15.4 Метрики

Заедно, на един и същ времеви обхват (7 дни) и на един и същ мащаб:

* **Memory (RSS)** — цялата седмица, не последните часове. Търсете формата:
  права линия (leak) срещу стъпала (плато + пикове). **По измерванията тук
  очаквам стъпала.**
* **CPU** — конкретно дали има кратки шипове точно преди всеки OOM. Средното
  ~0 не изключва шипове — минутните бъкети ги заглаждат. AVIF на 0,5 CPU би
  дал точно такъв профил.
* **HTTP заявки на минута** и **p95 latency** около сривовете. Ако latency
  скача преди OOM → заявки се редят на опашка, всяка държи памет.
* **Instance count / restarts** — брой рестарти за седмица.
* **PostgreSQL: активни връзки** — да се потвърди, че таванът от 10 не се
  удря (за изключване на изтощаване на pool-а).
* **Bandwidth (изходящ)** — базова стойност преди Тест B; при
  `unoptimized: true` ще скочи и това е очаквано.

### 15.5 Едно нещо от Render Shell (най-важното)

Размерите **в пиксели** на реалните снимки на диска. Това е единичната
информация с най-голяма диагностична стойност и я няма как да се получи отвън:

```bash
# Render Shell, в директорията на услугата.
# Изисква ImageMagick; ако липсва, вижте варианта с node по-долу.
find public/uploads -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' \) \
  -exec identify -format '%w %h %B %f\n' {} \; 2>/dev/null | sort -rn | head -30

# Общо и брой
du -sh public/uploads && find public/uploads -type f | wc -l
```

Без ImageMagick, със същия sharp, който Next вече използва:

```bash
node -e '
const sharp=require("sharp"), fs=require("fs"), path=require("path"), out=[];
(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){
  const p=path.join(d,e.name);
  if(e.isDirectory()) walk(p);
  else if(/\.(jpe?g|png|webp)$/i.test(e.name)) out.push(p);}})("public/uploads");
(async()=>{const r=[];
  for(const f of out){try{const m=await sharp(f).metadata();
    r.push({f:path.basename(f),w:m.width,h:m.height,mp:+(m.width*m.height/1e6).toFixed(1),
            kb:Math.round(fs.statSync(f).size/1024)});}catch{}}
  r.sort((a,b)=>b.mp-a.mp);
  console.log("файлове:",r.length);
  console.log("общо мегапиксели:",r.reduce((s,x)=>s+x.mp,0).toFixed(1));
  console.log("най-големи 20:"); console.table(r.slice(0,20));
})();'
```

**Как се разчита:** ако най-големите са над ~12 MP (напр. 4000×3000), проблем
5.1 се повишава на **High** и P1-1 (преоразмеряване при качване) става
приоритет №1, преди всичко останало. Ако всички са под ~2 MP, 5.1 отпада и
основната тежест остава върху конкурентността и AVIF (P1-2).

Полезно и:

```bash
# Колко варианта държи image кешът и колко е голям (ефемерен — изчезва при рестарт)
du -sh .next/cache/images 2>/dev/null; ls .next/cache/images 2>/dev/null | wc -l

# Какъв heap лимит вижда V8 в контейнера — проверява 4.7 директно
node -e 'const v=require("v8").getHeapStatistics();
console.log("heap_size_limit MB:",Math.round(v.heap_size_limit/1048576));
console.log("os.totalmem MB:",Math.round(require("os").totalmem()/1048576));
console.log("cpus:",require("os").cpus().length);'
```

Последната команда е особено ценна: ако `heap_size_limit` излезе значително над
512 и `cpus` над 2, това **потвърждава наведнъж** и 4.7 (V8 не знае за лимита),
и механизма от 4.4 (sharp concurrency от ядрата на хоста) — двете с една
команда, без деплой.

### 15.6 Какво още е нужно за окончателно посочване на причината

| Въпрос | Как се отговаря | Какво решава |
|---|---|---|
| Плато или leak? | наклонът на RSS за седмица + `MEMLOG` `heapUsedMB` спрямо `rssMB` | ако `heapUsedMB` е плосък → потвърждава раздел 9 окончателно |
| V8 OOM или cgroup OOM? | търсене на `heap out of memory` в логовете | разделя JS heap от native памет |
| Големи ли са снимките? | 15.5 | приоритет между P1-1 и P1-2 |
| Еконт конфигуриран ли е? | наличие на `ECONT_USERNAME` в Environment (само дали е зададен — **не** показвайте стойността) | ако не е, 4.2 и 4.3 отпадат напълно |
| Има ли ботова активност? | 15.3, точки 2 и 5 | приоритет на P1-3 |
| Всички ли сривове са OOM? | 15.2, филтри `Killed` / `Error:` / `pg` | ако не → 4.5 се качва в приоритета |
| Съвпадат ли пиковете с качвания? | Тест F + времеви марки на файловете в `public/uploads` | изключва или потвърждава 5.4 |

---

## Потвърждения

**Source кодът не е променян.** Не е правен нито един commit, push, deploy или
миграция. Не е изпълняван тест срещу публичния сайт или production базата. Не са
използвани production credentials — локалният тест мина изцяло на вградена
PGlite база, `EMAIL_PROVIDER=console`, `STORAGE_PROVIDER=local`,
`ECONT_ENVIRONMENT=demo`. Единственият създаден файл е този отчет.

**В отчета не са включени стойности на environment variables, пароли, токени,
connection strings или други тайни** — само имената на променливите и
непроизводствени, нечувствителни стойности (`EMAIL_PROVIDER=console`,
`STORAGE_PROVIDER=local`, `ECONT_ENVIRONMENT=demo`, `PGLITE_DIR=.data/pglite`,
`APP_URL=http://localhost:3000`), взети от `.env.local`.

**`git status --short`:**

```
```

(празно — работното дърво е чисто; `.next/`, `node_modules/` и `.data/` са в
`.gitignore`, а самият отчет е добавен в кореновата директория и ще се появи
като нов untracked файл, щом бъде записан)

**Промени извън source кода, извършени за целите на одита:** `npm ci` (пълна
инсталация по lock файла — devDependencies липсваха и без тях lint, typecheck,
тестовете и билдът бяха невъзможни), `npm run build` (исканата production build
проверка) и няколко изтривания на `.next/cache/images` като част от memory
теста. Всички са обратими и нито едно не докосва проследяван от Git файл.
