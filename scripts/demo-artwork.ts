/**
 * Generates the placeholder gallery artwork used while the real photography is
 * missing. Original vector compositions in the Cakes by ELI palette — nothing
 * is copied from third-party sources, and every item is flagged `isDemo` so it
 * can be swapped for a real photograph from the admin panel.
 */

const PALETTES: [string, string][] = [
  ["#e8ccc6", "#a8616c"],
  ["#e3d2bd", "#8f5f3e"],
  ["#d9c9d5", "#7f6077"],
  ["#cdd5c2", "#6f7a63"],
  ["#f1d3bd", "#b96f59"],
  ["#e6d0cd", "#8f4e5d"],
  ["#ded0bb", "#9c7a4c"],
  ["#d6c6b6", "#7a5a45"],
];

const W = 900;
const H = 1100;

export function renderDemoArtwork(index: number, caption: string): string {
  const [light, dark] = PALETTES[index % PALETTES.length];
  const subject = SUBJECTS[index % SUBJECTS.length](light, dark);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${escapeXml(caption)}">
  <title>${escapeXml(caption)}</title>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.7" y2="1">
      <stop offset="0" stop-color="${light}"/>
      <stop offset="1" stop-color="${dark}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.7" cy="0.18" r="0.6">
      <stop offset="0" stop-color="#fdf3e6" stop-opacity="0.85"/>
      <stop offset="1" stop-color="#fdf3e6" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="cream" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fffaf2"/>
      <stop offset="1" stop-color="#f2ddd4"/>
    </linearGradient>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="16"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <circle cx="720" cy="180" r="150" fill="#fdf3e6" opacity="0.35"/>
  <ellipse cx="450" cy="${H - 150}" rx="330" ry="46" fill="#2f211d" opacity="0.14" filter="url(#soft)"/>
  <circle cx="130" cy="${H - 210}" r="72" fill="none" stroke="#fffdf9" stroke-opacity="0.35" stroke-width="1.5"/>

  ${subject}
</svg>
`;
}

type Subject = (light: string, dark: string) => string;

const SUBJECTS: Subject[] = [
  // Two-tier cake
  () => `
  <g transform="translate(450 ${H - 190})">
    <ellipse cx="0" cy="0" rx="250" ry="34" fill="#e9d2bd"/>
    <ellipse cx="0" cy="-6" rx="250" ry="30" fill="#f6e5d2"/>
    <rect x="-165" y="-190" width="330" height="188" rx="26" fill="url(#cream)"/>
    <rect x="-120" y="-330" width="240" height="146" rx="24" fill="url(#cream)"/>
    <rect x="-165" y="-58" width="330" height="12" fill="#8f4e5d" opacity="0.75"/>
    <rect x="-120" y="-206" width="240" height="10" fill="#8f4e5d" opacity="0.75"/>
    ${berries(-95, -250, 5)}
    ${gold(70, -300)}
    ${gold(-60, -120)}
  </g>`,

  // Chocolate drip cake
  () => `
  <g transform="translate(450 ${H - 190})">
    <ellipse cx="0" cy="0" rx="240" ry="32" fill="#e9d2bd"/>
    <rect x="-160" y="-270" width="320" height="268" rx="28" fill="url(#cream)"/>
    <path d="M-160 -250 h320 v40 q-24 34 -46 4 q-22 40 -46 6 q-24 36 -48 2 q-22 38 -46 6 q-24 34 -48 2 q-22 34 -46 4 z" fill="#5a3524"/>
    ${berries(-100, -286, 6)}
    ${gold(96, -150)}
  </g>`,

  // Éclair row
  () => `
  <g transform="translate(450 ${H - 260})">
    ${[0, 1, 2].map((i) => `
    <g transform="translate(${-160 + i * 160} ${i % 2 === 0 ? 0 : 60}) rotate(${i * 4 - 4})">
      <rect x="-70" y="-26" width="140" height="52" rx="26" fill="#e8c79b"/>
      <rect x="-64" y="-30" width="128" height="26" rx="13" fill="#4f2f22"/>
      <circle cx="-24" cy="-22" r="5" fill="#bfd0a0"/>
      <circle cx="8" cy="-24" r="4" fill="#bfd0a0"/>
      <circle cx="34" cy="-20" r="4.5" fill="#caa779"/>
    </g>`).join("")}
  </g>`,

  // Macaron stack
  () => `
  <g transform="translate(450 ${H - 240})">
    ${[
      ["#f2d7d7", -140, 0, -8],
      ["#e3aeb6", 0, -30, 4],
      ["#bcc4ae", 140, 10, -3],
      ["#f7e7d3", -70, -150, 6],
      ["#d3c8dd", 70, -180, -5],
    ]
      .map(
        ([color, x, y, r]) => `
    <g transform="translate(${x} ${y}) rotate(${r})">
      <ellipse cx="0" cy="-20" rx="66" ry="34" fill="${color}"/>
      <ellipse cx="0" cy="20" rx="66" ry="34" fill="${color}"/>
      <rect x="-62" y="-6" width="124" height="16" rx="8" fill="#fffaf2" opacity="0.9"/>
      <ellipse cx="0" cy="-26" rx="52" ry="20" fill="#fffdf9" opacity="0.25"/>
    </g>`,
      )
      .join("")}
  </g>`,

  // Cupcakes
  () => `
  <g transform="translate(450 ${H - 250})">
    ${[-170, 0, 170].map((x, i) => `
    <g transform="translate(${x} ${i === 1 ? -40 : 0})">
      <path d="M-58 0 L-46 96 h92 L58 0 z" fill="#c9946a"/>
      <path d="M-58 0 h116" stroke="#a97c56" stroke-width="4"/>
      <path d="M-56 0 q-6 -58 34 -66 q10 -40 46 -22 q40 -14 46 26 q34 16 22 62 z" fill="#f4dcd6"/>
      <circle cx="0" cy="-84" r="10" fill="#c8515c"/>
      <circle cx="-30" cy="-40" r="4" fill="#caa779"/>
      <circle cx="26" cy="-32" r="4" fill="#caa779"/>
    </g>`).join("")}
  </g>`,

  // Heart mini cake
  () => `
  <g transform="translate(450 ${H - 230})">
    <ellipse cx="0" cy="10" rx="200" ry="28" fill="#e9d2bd"/>
    <path d="M0 -30 C-52 -130 -180 -102 -180 -18 C-180 46 -78 82 0 128 C78 82 180 46 180 -18 C180 -102 52 -130 0 -30 Z" fill="url(#cream)"/>
    <path d="M0 -30 C-52 -130 -180 -102 -180 -18 C-180 46 -78 82 0 128 C78 82 180 46 180 -18 C180 -102 52 -130 0 -30 Z" fill="#e3aeb6" opacity="0.35"/>
    ${gold(-80, 6)}
    ${gold(70, 30)}
    ${berries(-30, -6, 3)}
  </g>`,

  // Decorated cookies
  () => `
  <g transform="translate(450 ${H - 300})">
    ${[
      [-150, 0, "#f7e7d3"],
      [40, -60, "#e3aeb6"],
      [180, 40, "#bcc4ae"],
      [-40, 120, "#d8ab74"],
    ]
      .map(
        ([x, y, c]) => `
    <g transform="translate(${x} ${y})">
      <circle r="72" fill="#dcb98c"/>
      <circle r="60" fill="${c}"/>
      <circle r="60" fill="none" stroke="#fffdf9" stroke-width="3" stroke-opacity="0.6"/>
      <path d="M-28 6 q28 -30 56 0" fill="none" stroke="#fffdf9" stroke-width="4" stroke-linecap="round" stroke-opacity="0.85"/>
    </g>`,
      )
      .join("")}
  </g>`,

  // Sweet bar composition
  () => `
  <g transform="translate(450 ${H - 210})">
    <rect x="-300" y="-16" width="600" height="18" rx="9" fill="#e9d2bd"/>
    <g transform="translate(-190 -16)">
      <rect x="-72" y="-130" width="144" height="130" rx="20" fill="url(#cream)"/>
      <rect x="-72" y="-48" width="144" height="9" fill="#8f4e5d" opacity="0.7"/>
    </g>
    <g transform="translate(0 -16)">
      ${[0, 1, 2].map((i) => `<g transform="translate(${-50 + i * 50} ${-40 - i * 4})">
        <ellipse cx="0" cy="-14" rx="34" ry="18" fill="#f2d7d7"/>
        <ellipse cx="0" cy="10" rx="34" ry="18" fill="#f2d7d7"/>
        <rect x="-31" y="-4" width="62" height="10" rx="5" fill="#fffaf2"/>
      </g>`).join("")}
    </g>
    <g transform="translate(200 -16)">
      ${[0, 1].map((i) => `<g transform="translate(${-34 + i * 68} ${-34})">
        <path d="M-30 0 L-24 46 h48 L30 0 z" fill="#c9946a"/>
        <path d="M-29 0 q-3 -32 18 -36 q6 -22 24 -12 q22 -8 24 14 q18 9 12 34 z" fill="#f4dcd6"/>
      </g>`).join("")}
    </g>
    ${gold(-250, -70)}
    ${gold(260, -96)}
  </g>`,
];

function berries(x: number, y: number, count: number): string {
  return Array.from({ length: count })
    .map((_, i) => {
      const cx = x + i * 44 + (i % 2) * 8;
      const cy = y + (i % 3) * 9;
      return `<circle cx="${cx}" cy="${cy}" r="15" fill="#c8515c"/><circle cx="${cx - 4}" cy="${cy - 5}" r="4" fill="#fff" opacity="0.35"/>`;
    })
    .join("");
}

function gold(x: number, y: number): string {
  return `<path d="M${x} ${y} l16 -9 l-4 18 l14 -6 l-12 20 l-16 4 l6 -14 z" fill="#caa779" opacity="0.9"/>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
