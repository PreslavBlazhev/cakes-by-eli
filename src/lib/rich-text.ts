/**
 * The product description's format: plain text in which `<strong>` and
 * `</strong>` are the only markup. Anything else that looks like a tag is just
 * text, and every description written before bold existed is already valid, so
 * the old rows need no migration.
 *
 * The public page renders the parsed segments as React text and never as HTML,
 * so a stored value cannot inject anything however it got into the database.
 */

export type RichTextSegment = { text: string; bold: boolean };

const TAG = /(<\/?strong>)/;

function merged(segments: RichTextSegment[]): RichTextSegment[] {
  const out: RichTextSegment[] = [];
  for (const { text, bold } of segments) {
    if (!text) continue;
    // Bold on nothing but whitespace is invisible; keeping it would leave
    // markup in the row that the owner can neither see nor remove.
    const isBold = bold && text.trim() !== "";
    const last = out.at(-1);
    if (last && last.bold === isBold) last.text += text;
    else out.push({ text, bold: isBold });
  }
  return out;
}

function trimmed(segments: RichTextSegment[]): RichTextSegment[] {
  const out = segments.map((segment) => ({ ...segment }));
  while (out[0] && !(out[0].text = out[0].text.trimStart())) out.shift();
  while (out.at(-1)) {
    const last = out[out.length - 1];
    last.text = last.text.trimEnd();
    if (last.text) break;
    out.pop();
  }
  return out;
}

function tidy(segments: RichTextSegment[]): RichTextSegment[] {
  return merged(trimmed(merged(segments)));
}

export function parseRichText(value: string): RichTextSegment[] {
  const segments: RichTextSegment[] = [];
  let bold = false;
  for (const part of value.replace(/\r\n?/g, "\n").split(TAG)) {
    if (part === "<strong>") bold = true;
    else if (part === "</strong>") bold = false;
    else segments.push({ text: part, bold });
  }
  return tidy(segments);
}

function serialize(segments: RichTextSegment[]): string {
  return segments
    .map(({ text, bold }) => (bold ? `<strong>${text}</strong>` : text))
    .join("");
}

/** The canonical spelling of a stored or submitted description. */
export function normalizeRichText(value: string): string {
  return serialize(parseRichText(value));
}

/** The words alone — for meta tags and for measuring length. */
export function richTextToPlain(value: string): string {
  return parseRichText(value)
    .map((segment) => segment.text)
    .join("");
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The editor's starting content. Everything but the bold tags is escaped. */
export function richTextToEditorHtml(value: string): string {
  return parseRichText(value)
    .map(({ text, bold }) => {
      const html = escapeHtml(text).replace(/\n/g, "<br>");
      return bold ? `<strong>${html}</strong>` : html;
    })
    .join("");
}

/* ------------------------------------------------------------------ *
 * Reading the editor back
 * ------------------------------------------------------------------ */

/** The part of a DOM node the reader needs, so tests can stand one in. */
export type RichTextNode = {
  nodeType: number;
  nodeName: string;
  nodeValue: string | null;
  childNodes: ArrayLike<RichTextNode>;
  nextSibling: RichTextNode | null;
  parentNode: RichTextNode | null;
  style?: { fontWeight?: string };
};

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

const BLOCKS = new Set([
  "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DD", "DIV", "DL", "DT", "FIGURE",
  "FOOTER", "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HR", "LI", "MAIN", "NAV",
  "OL", "P", "PRE", "SECTION", "TABLE", "TR", "UL",
]);

function boldInside(node: RichTextNode, inherited: boolean): boolean {
  const weight = node.style?.fontWeight;
  if (weight === "normal" || weight === "lighter") return false;
  if (weight === "bold" || weight === "bolder") return true;
  const numeric = Number(weight);
  if (weight && Number.isFinite(numeric)) return numeric >= 600;
  return node.nodeName === "STRONG" || node.nodeName === "B" || inherited;
}

/**
 * Turns whatever markup the browser's editing engine produced — they disagree —
 * into the stored format. Only the words, the line breaks and the bold survive.
 */
export function richTextFromDom(root: RichTextNode): string {
  const segments: RichTextSegment[] = [];
  let atLineStart = true;

  const breakLine = () => {
    segments.push({ text: "\n", bold: false });
    atLineStart = true;
  };

  // A browser draws no empty line for the last <br> of a block: it only holds
  // the line open. Counting it would add a line on every load and save.
  const endsBlock = (node: RichTextNode) => {
    let current: RichTextNode | null = node;
    while (current && current !== root && !BLOCKS.has(current.nodeName)) {
      for (let next = current.nextSibling; next; next = next.nextSibling) {
        if (next.nodeType !== TEXT_NODE || next.nodeValue) return false;
      }
      current = current.parentNode;
    }
    return true;
  };

  const walk = (node: RichTextNode, bold: boolean) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === TEXT_NODE) {
        const text = (child.nodeValue ?? "").replace(/ /g, " ");
        if (!text) continue;
        segments.push({ text, bold });
        atLineStart = text.endsWith("\n");
      } else if (child.nodeType === ELEMENT_NODE) {
        if (child.nodeName === "BR") {
          if (!atLineStart && endsBlock(child)) continue;
          breakLine();
        } else if (BLOCKS.has(child.nodeName)) {
          if (!atLineStart) breakLine();
          walk(child, boldInside(child, bold));
          if (!atLineStart) breakLine();
        } else {
          walk(child, boldInside(child, bold));
        }
      }
    }
  };

  walk(root, false);
  return serialize(tidy(segments));
}
