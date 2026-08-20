/**
 * Bulgarian → Latin transliteration for URL slugs.
 *
 * The UI stays in Bulgarian while URLs stay ASCII, which avoids percent-encoded
 * links breaking when they are pasted into Messenger, Viber or Instagram bios.
 * Follows the official Bulgarian streamlined transliteration system.
 */
const MAP: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sht",
  ъ: "a",
  ь: "y",
  ю: "yu",
  я: "ya",
};

export function transliterate(input: string): string {
  let out = "";
  for (const char of input.toLowerCase()) {
    out += MAP[char] ?? char;
  }
  return out;
}

export function slugify(input: string): string {
  return transliterate(input)
    .normalize("NFD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/** Appends `-2`, `-3`, … until the slug no longer collides. */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const root = slugify(base) || "item";
  if (!used.has(root)) return root;

  let n = 2;
  while (used.has(`${root}-${n}`)) n += 1;
  return `${root}-${n}`;
}
