/**
 * Landscape placeholder artwork for product and category cards.
 *
 * The catalogue has to look like a catalogue before the real photographs
 * exist, otherwise every card is an empty coloured rectangle. Each dessert
 * kind gets its own original vector composition in the Cakes by ELI palette;
 * everything produced here is flagged as demo content and is replaced by a
 * real photograph from the admin panel.
 */

const W = 1200;
const H = 900;

/** Ground line the subjects stand on. */
const BASE = 700;

export type ArtworkKind =
  | "cake"
  | "minicake"
  | "cheesecake"
  | "eclair"
  | "macaron"
  | "cupcake"
  | "cookie"
  | "cakepop"
  | "tartlet"
  | "box";

const PALETTES: Record<ArtworkKind, [string, string]> = {
  cake: ["#f0d8d2", "#c08791"],
  minicake: ["#f4dcdc", "#cf95a1"],
  cheesecake: ["#e7dfcd", "#a8956d"],
  eclair: ["#eddcc6", "#a97852"],
  macaron: ["#e6dced", "#9b86ab"],
  cupcake: ["#f3dcd0", "#c58a76"],
  cookie: ["#efe2c8", "#b79457"],
  cakepop: ["#e2dfd0", "#8d9169"],
  tartlet: ["#f2e0c8", "#bd8a53"],
  box: ["#e6d8ce", "#96725c"],
};

export function renderProductArtwork(
  kind: ArtworkKind,
  caption: string,
  seed = 0,
): string {
  const [light, dark] = PALETTES[kind] ?? PALETTES.cake;
  const subject = SUBJECTS[kind](seed);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${escapeXml(caption)}">
  <title>${escapeXml(caption)}</title>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0" stop-color="${light}"/>
      <stop offset="1" stop-color="${dark}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.68" cy="0.16" r="0.72">
      <stop offset="0" stop-color="#fdf5ea" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#fdf5ea" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="cream" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fffbf4"/>
      <stop offset="1" stop-color="#f2ddd3"/>
    </linearGradient>
    <linearGradient id="plate" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f6e6cf"/>
      <stop offset="1" stop-color="#d9bb94"/>
    </linearGradient>
    <filter id="soft" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="22"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <circle cx="960" cy="180" r="190" fill="#fdf5ea" opacity="0.3"/>
  <circle cx="170" cy="740" r="96" fill="none" stroke="#fffdf9" stroke-opacity="0.32" stroke-width="2"/>
  <ellipse cx="600" cy="${BASE + 40}" rx="380" ry="54" fill="#2f211d" opacity="0.16" filter="url(#soft)"/>

${subject}
</svg>
`;
}

/* ------------------------------------------------------------------ *
 * Subjects
 * ------------------------------------------------------------------ */

const SUBJECTS: Record<ArtworkKind, (seed: number) => string> = {
  cake: () => `
  <g transform="translate(600 ${BASE})">
    ${plate(300)}
    <rect x="-215" y="-250" width="430" height="248" rx="34" fill="url(#cream)"/>
    <rect x="-215" y="-250" width="430" height="248" rx="34" fill="#c08791" opacity="0.16"/>
    <ellipse cx="0" cy="-250" rx="215" ry="30" fill="#fffbf4"/>
    <rect x="-215" y="-72" width="430" height="15" fill="#8f4e5d" opacity="0.7"/>
    <rect x="-155" y="-432" width="310" height="196" rx="30" fill="url(#cream)"/>
    <ellipse cx="0" cy="-432" rx="155" ry="24" fill="#fffbf4"/>
    <rect x="-155" y="-282" width="310" height="12" fill="#caa779" opacity="0.85"/>
    ${berries(-118, -448, 5, 44)}
    ${gold(120, -390)}
    ${gold(-172, -150)}
    ${leaf(150, -430)}
  </g>`,

  minicake: () => `
  <g transform="translate(600 ${BASE})">
    ${plate(250)}
    <path d="M0 -70 C-70 -270 -330 -216 -330 -52 C-330 66 -140 128 0 214 C140 128 330 66 330 -52 C330 -216 70 -270 0 -70 Z"
          transform="translate(0 -150) scale(0.62)" fill="url(#cream)"/>
    <path d="M0 -70 C-70 -270 -330 -216 -330 -52 C-330 66 -140 128 0 214 C140 128 330 66 330 -52 C330 -216 70 -270 0 -70 Z"
          transform="translate(0 -150) scale(0.62)" fill="#cf95a1" opacity="0.3"/>
    ${berries(-70, -190, 3, 48)}
    ${gold(-140, -110)}
    ${gold(120, -140)}
  </g>`,

  cheesecake: () => `
  <g transform="translate(600 ${BASE})">
    ${plate(300)}
    <rect x="-200" y="-150" width="400" height="148" rx="20" fill="#e6c79a"/>
    <rect x="-200" y="-210" width="400" height="70" rx="14" fill="url(#cream)"/>
    <ellipse cx="0" cy="-210" rx="200" ry="30" fill="#fffbf4"/>
    <path d="M-200 -206 q40 34 80 6 q42 32 82 4 q40 30 80 2 q40 30 80 4 q22 16 38 6 v34 h-360 z" fill="#a83a56" opacity="0.85"/>
    ${berries(-140, -232, 6, 52)}
    ${leaf(-186, -212)}
  </g>`,

  eclair: (seed) => `
  <g transform="translate(600 ${BASE - 60})">
    ${board(400, 150)}
    ${[0, 1, 2]
      .map((i) => {
        const x = -250 + i * 250;
        const y = i === 1 ? -46 : 0;
        return `
    <g transform="translate(${x} ${y}) rotate(${((i + seed) % 3) - 1})">
      <ellipse cx="0" cy="52" rx="118" ry="20" fill="#2f211d" opacity="0.14"/>
      <rect x="-118" y="-38" width="236" height="80" rx="40" fill="#e8c79b"/>
      <rect x="-118" y="6" width="236" height="34" rx="17" fill="#c79c68" opacity="0.5"/>
      <path d="M-112 -38 h224 a34 34 0 0 1 0 44 q-30 10 -58 -2 q-30 12 -58 0 q-30 12 -58 -2 q-26 10 -50 2 a34 34 0 0 1 0 -42 z" fill="#4f2f22"/>
      <ellipse cx="-40" cy="-26" rx="44" ry="9" fill="#fff" opacity="0.2"/>
      <circle cx="-48" cy="-8" r="9" fill="#bfd0a0"/>
      <circle cx="8" cy="-12" r="8" fill="#bfd0a0"/>
      <circle cx="58" cy="-6" r="8" fill="#caa779"/>
    </g>`;
      })
      .join("")}
  </g>`,

  macaron: () => `
  <g transform="translate(600 ${BASE - 30})">
    ${plate(320)}
    ${[
      ["#f2d7d7", -230, 0, -6],
      ["#e3aeb6", 0, -40, 5],
      ["#bcc4ae", 230, 14, -4],
      ["#f7e7d3", -120, -230, 7],
      ["#d3c8dd", 120, -270, -6],
    ]
      .map(
        ([color, x, y, r]) => `
    <g transform="translate(${x} ${y}) rotate(${r})">
      <ellipse cx="0" cy="66" rx="104" ry="18" fill="#2f211d" opacity="0.13"/>
      <ellipse cx="0" cy="26" rx="106" ry="52" fill="${color}"/>
      <path d="M-104 26 q18 38 104 38 q86 0 104 -38 q-12 46 -104 46 q-92 0 -104 -46 z" fill="#2f211d" opacity="0.16"/>
      <rect x="-98" y="-14" width="196" height="34" rx="17" fill="#fffaf2"/>
      <ellipse cx="0" cy="-54" rx="106" ry="52" fill="${color}"/>
      <ellipse cx="-32" cy="-72" rx="52" ry="20" fill="#fffdf9" opacity="0.3"/>
    </g>`,
      )
      .join("")}
  </g>`,

  cupcake: () => `
  <g transform="translate(600 ${BASE - 20})">
    ${plate(320)}
    ${[-260, 0, 260]
      .map(
        (x, i) => `
    <g transform="translate(${x} ${i === 1 ? -70 : 0})">
      <ellipse cx="0" cy="150" rx="96" ry="20" fill="#2f211d" opacity="0.13"/>
      <path d="M-92 0 L-72 148 h144 L92 0 z" fill="#c9946a"/>
      ${[0, 1, 2, 3, 4, 5].map((j) => `<path d="M${-76 + j * 30} 6 L${-60 + j * 25} 142" stroke="#9a6a41" stroke-width="4" opacity="0.4"/>`).join("")}
      <path d="M-92 0 h184" stroke="#8f5f39" stroke-width="7"/>
      <path d="M-90 0 q-10 -92 54 -104 q16 -64 74 -36 q64 -22 74 42 q54 26 34 98 z" fill="url(#cream)"/>
      <path d="M-90 0 q-10 -92 54 -104 q16 -64 74 -36 q64 -22 74 42 q54 26 34 98 z" fill="#c58a76" opacity="0.22"/>
      <circle cx="0" cy="-134" r="17" fill="#c8515c"/>
      <circle cx="-46" cy="-66" r="7" fill="#caa779"/>
      <circle cx="44" cy="-52" r="7" fill="#caa779"/>
      <circle cx="8" cy="-30" r="6" fill="#a7ad94"/>
    </g>`,
      )
      .join("")}
  </g>`,

  cookie: () => `
  <g transform="translate(600 ${BASE - 40})">
    ${board(420, 170)}
    ${[
      ["round", -250, 10, "#f7e7d3"],
      ["heart", 0, -50, "#e3aeb6"],
      ["star", 250, 16, "#bcc4ae"],
    ]
      .map(([shape, x, y, color]) => {
        const inner =
          shape === "heart"
            ? `<path d="M0 76 C-118 -8 -76 -102 0 -38 C76 -102 118 -8 0 76 Z" fill="COLOR"/>`
            : shape === "star"
              ? `<path d="M0 -92 L26 -30 L92 -26 L42 16 L58 82 L0 46 L-58 82 L-42 16 L-92 -26 L-26 -30 Z" fill="COLOR"/>`
              : `<circle r="88" fill="COLOR"/>`;
        return `
    <g transform="translate(${x} ${y})">
      <ellipse cx="0" cy="108" rx="98" ry="18" fill="#2f211d" opacity="0.13"/>
      <circle r="104" fill="#dcb98c"/>
      <circle r="104" fill="#c9a071" opacity="0.35" transform="translate(0 6)"/>
      <circle r="102" fill="#e0b985"/>
      ${inner.replace("COLOR", String(color))}
      <circle r="60" fill="none" stroke="#fffdf9" stroke-width="4" stroke-opacity="0.7" stroke-dasharray="10 12"/>
    </g>`;
      })
      .join("")}
  </g>`,

  cakepop: () => `
  <g transform="translate(600 ${BASE - 10})">
    <rect x="-230" y="-4" width="460" height="120" rx="30" fill="#b28954"/>
    <rect x="-230" y="-20" width="460" height="120" rx="30" fill="url(#plate)"/>
    ${[-170, 0, 170]
      .map((x, i) => {
        const lift = i === 1 ? 250 : 190;
        return `
    <g>
      <rect x="${x - 7}" y="${-lift + 60}" width="14" height="${lift - 40}" rx="7" fill="#f3e5d0"/>
      <circle cx="${x}" cy="${-lift}" r="80" fill="${["#7a4b34", "#e3aeb6", "#f4e6cf"][i]}"/>
      <ellipse cx="${x - 26}" cy="${-lift - 28}" rx="26" ry="14" fill="#fff" opacity="0.28"/>
      ${[0, 1, 2, 3, 4, 5].map((j) => `<rect x="${x - 46 + j * 18}" y="${-lift - 30 + (j % 3) * 24}" width="14" height="5" rx="2.5" fill="${["#c8515c", "#caa779", "#a7ad94", "#fdf4ea"][j % 4]}"/>`).join("")}
    </g>`;
      })
      .join("")}
  </g>`,

  tartlet: () => `
  <g transform="translate(600 ${BASE - 40})">
    ${plate(320)}
    ${[-180, 180]
      .map(
        (x, i) => `
    <g transform="translate(${x} ${i === 0 ? 0 : -30})">
      <ellipse cx="0" cy="96" rx="140" ry="22" fill="#2f211d" opacity="0.13"/>
      <path d="M-140 -20 L-120 86 h240 L140 -20 z" fill="#d3a973"/>
      ${[0, 1, 2, 3, 4, 5, 6].map((j) => `<path d="M${-126 + j * 42} -12 L${-112 + j * 37} 80" stroke="#b98d5b" stroke-width="6" opacity="0.55"/>`).join("")}
      <ellipse cx="0" cy="-20" rx="140" ry="34" fill="#f6e9d2"/>
      <ellipse cx="0" cy="-26" rx="126" ry="28" fill="#fffbf4"/>
      <circle cx="-58" cy="-30" r="26" fill="#c8515c"/>
      <circle cx="6" cy="-38" r="24" fill="#a83a56"/>
      <circle cx="64" cy="-28" r="22" fill="#4a4a72"/>
      ${leaf(-8, -58)}
    </g>`,
      )
      .join("")}
  </g>`,

  box: () => `
  <g transform="translate(600 ${BASE - 60})">
    <rect x="-380" y="-330" width="760" height="420" rx="42" fill="#d5b48c"/>
    <rect x="-380" y="-352" width="760" height="420" rx="42" fill="url(#plate)"/>
    <rect x="-344" y="-318" width="688" height="352" rx="30" fill="#fdf6ec"/>
    <rect x="-380" y="-160" width="760" height="26" fill="#8f4e5d" opacity="0.18"/>
    ${[
      [-230, -240, "#f2d7d7"],
      [-10, -240, "#e3aeb6"],
      [210, -240, "#bcc4ae"],
      [-230, -60, "#f7e7d3"],
      [-10, -60, "#d8ab74"],
      [210, -60, "#d3c8dd"],
    ]
      .map(
        ([x, y, c], i) => `
    <g transform="translate(${x} ${y})">
      <circle r="88" fill="#f6e6d2" opacity="0.8"/>
      <circle r="88" fill="none" stroke="#e3cdb0" stroke-width="2"/>
      ${
        i % 3 === 0
          ? `<ellipse cx="0" cy="-14" rx="58" ry="28" fill="${c}"/><rect x="-52" y="-4" width="104" height="16" rx="8" fill="#fffaf2"/><ellipse cx="0" cy="24" rx="58" ry="28" fill="${c}"/>`
          : i % 3 === 1
            ? `<rect x="-64" y="-22" width="128" height="46" rx="23" fill="#e2bd88"/><rect x="-62" y="-26" width="118" height="24" rx="12" fill="#4f2f22"/>`
            : `<path d="M-48 0 L-38 62 h76 L48 0 z" fill="#c9946a"/><path d="M-48 0 q0 -58 48 -58 q48 0 48 58 z" fill="${c}"/><circle cx="0" cy="-62" r="11" fill="#c8515c"/>`
      }
    </g>`,
      )
      .join("")}
  </g>`,
};

/* ------------------------------------------------------------------ *
 * Shared pieces
 * ------------------------------------------------------------------ */

function plate(radius: number): string {
  return `<ellipse cx="0" cy="14" rx="${radius}" ry="${radius * 0.13}" fill="#c8a276"/>
    <ellipse cx="0" cy="2" rx="${radius}" ry="${radius * 0.13}" fill="url(#plate)"/>`;
}

function board(halfWidth: number, halfHeight: number): string {
  return `<rect x="${-halfWidth}" y="${-halfHeight + 16}" width="${halfWidth * 2}" height="${halfHeight * 2}" rx="34" fill="#d8bb95"/>
    <rect x="${-halfWidth}" y="${-halfHeight}" width="${halfWidth * 2}" height="${halfHeight * 2}" rx="34" fill="url(#plate)"/>`;
}

function berries(x: number, y: number, count: number, step: number): string {
  return Array.from({ length: count })
    .map((_, i) => {
      const cx = x + i * step;
      const cy = y + (i % 3) * 12;
      return `<circle cx="${cx}" cy="${cy}" r="22" fill="#c8515c"/><circle cx="${cx - 6}" cy="${cy - 7}" r="6" fill="#fff" opacity="0.35"/>`;
    })
    .join("");
}

function gold(x: number, y: number): string {
  return `<path d="M${x} ${y} l24 -13 l-6 27 l21 -9 l-18 30 l-24 6 l9 -21 z" fill="#caa779" opacity="0.92"/>`;
}

function leaf(x: number, y: number): string {
  return `<path d="M${x} ${y} C${x + 34} ${y - 12} ${x + 62} ${y - 4} ${x + 74} ${y + 14} C${x + 50} ${y + 32} ${x + 16} ${y + 28} ${x} ${y} Z" fill="#a7ad94"/>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Maps a seeded dessert type onto the artwork that suits it. */
export function artworkKindForDessert(slug: string | null): ArtworkKind {
  switch (slug) {
    case "torta":
      return "cake";
    case "mini-torta":
      return "minicake";
    case "chiyzkeyk":
      return "cheesecake";
    case "ekler":
      return "eclair";
    case "makaron":
      return "macaron";
    case "kapkeyk":
      return "cupcake";
    case "biskviti":
      return "cookie";
    case "keyk-pops":
      return "cakepop";
    case "tartaleti":
      return "tartlet";
    case "sladak-bar":
      return "box";
    default:
      return "cake";
  }
}

/** Maps a seeded category onto the artwork that suits it. */
export function artworkKindForCategory(slug: string): ArtworkKind {
  switch (slug) {
    case "torti":
      return "cake";
    case "mini-torti":
      return "minicake";
    case "chiyzkeykove":
      return "cheesecake";
    case "ekleri":
      return "eclair";
    case "makaroni":
      return "macaron";
    case "kapkeykove":
      return "cupcake";
    case "dekorirani-biskviti":
      return "cookie";
    case "keyk-pops":
      return "cakepop";
    case "tartaleti":
      return "tartlet";
    case "desertni-kutii":
      return "box";
    default:
      return "cake";
  }
}
