import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RichText } from "@/components/ui/RichText";
import {
  normalizeRichText,
  parseRichText,
  richTextFromDom,
  richTextToEditorHtml,
  richTextToPlain,
} from "@/lib/rich-text";
import type { RichTextNode } from "@/lib/rich-text";

/* A stand-in for the editor's DOM: the markup the browsers really produce is
 * exercised end to end in a browser, these pin down how it is read. */
type Spec = string | [string, ...Spec[]] | { tag: string; weight: string; children: Spec[] };

function build(spec: Spec, parent: RichTextNode | null): RichTextNode {
  if (typeof spec === "string") {
    return {
      nodeType: 3,
      nodeName: "#text",
      nodeValue: spec,
      childNodes: [],
      nextSibling: null,
      parentNode: parent,
    };
  }
  const [tag, children, weight] = Array.isArray(spec)
    ? [spec[0], spec.slice(1) as Spec[], undefined]
    : [spec.tag, spec.children, spec.weight];
  const node: RichTextNode = {
    nodeType: 1,
    nodeName: tag,
    nodeValue: null,
    childNodes: [],
    nextSibling: null,
    parentNode: parent,
    style: { fontWeight: weight ?? "" },
  };
  const built = children.map((child) => build(child, node));
  built.forEach((child, index) => {
    child.nextSibling = built[index + 1] ?? null;
  });
  node.childNodes = built;
  return node;
}

const read = (...children: Spec[]) =>
  richTextFromDom(build(["DIV", ...children], null));

describe("stored format", () => {
  it("leaves an old plain description exactly as it was", () => {
    const old = "Първи ред\nВтори ред\n\nНов абзац — 100% какао & мед";
    expect(normalizeRichText(old)).toBe(old);
    expect(parseRichText(old)).toEqual([{ text: old, bold: false }]);
  });

  it("treats Windows line endings from an old textarea as line breaks", () => {
    expect(normalizeRichText("а\r\nб")).toBe("а\nб");
  });

  it("recognises bold in the middle of a sentence", () => {
    expect(parseRichText("Торта с <strong>белгийски</strong> шоколад")).toEqual([
      { text: "Торта с ", bold: false },
      { text: "белгийски", bold: true },
      { text: " шоколад", bold: false },
    ]);
  });

  it("closes an unclosed tag and ignores a stray closing one", () => {
    expect(normalizeRichText("а <strong>б")).toBe("а <strong>б</strong>");
    expect(normalizeRichText("а</strong> б")).toBe("а б");
  });

  it("drops empty bold and bold on whitespace alone", () => {
    expect(normalizeRichText("а<strong></strong>б")).toBe("аб");
    expect(normalizeRichText("а<strong> </strong>б")).toBe("а б");
  });

  it("merges neighbouring bold runs", () => {
    expect(normalizeRichText("<strong>а</strong><strong>б</strong>")).toBe(
      "<strong>аб</strong>",
    );
  });

  it("gives the words alone for meta tags and length", () => {
    expect(richTextToPlain("Торта с <strong>шоколад</strong>")).toBe(
      "Торта с шоколад",
    );
  });
});

describe("safety", () => {
  const attack = `<script>alert(1)</script><img src=x onerror=alert(1)><b onclick="x()">б</b>`;

  it("renders any other markup as harmless text on the public page", () => {
    const html = renderToStaticMarkup(<RichText value={attack} />);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b ");
    expect(html).toContain("&lt;script&gt;");
  });

  it("does the same in the editor's starting content", () => {
    const html = richTextToEditorHtml(`<strong>${attack}</strong>\nред`);
    expect(html).toBe(
      "<strong>&lt;script&gt;alert(1)&lt;/script&gt;&lt;img src=x onerror=alert(1)&gt;" +
        `&lt;b onclick="x()"&gt;б&lt;/b&gt;</strong><br>ред`,
    );
  });

  it("cannot be tricked by a tag with attributes", () => {
    expect(parseRichText(`<strong onclick="x()">а</strong>`)).toEqual([
      { text: `<strong onclick="x()">а`, bold: false },
    ]);
  });

  it("shows bold as bold, with no tags in the visible text", () => {
    const html = renderToStaticMarkup(<RichText value="а <strong>б</strong>" />);
    expect(html).toContain(">б</strong>");
    expect(html).not.toContain("&lt;strong");
  });
});

describe("reading the editor", () => {
  it("reads the markup the editor starts with", () => {
    expect(read("а", ["BR"], ["STRONG", "б"], ["BR"], ["BR"], "в")).toBe(
      "а\n<strong>б</strong>\n\nв",
    );
  });

  it("reads Chrome's lines made of divs", () => {
    expect(read("а", ["DIV", "б"], ["DIV", ["BR"]], ["DIV", "в"])).toBe(
      "а\nб\n\nв",
    );
  });

  it("does not count the <br> that only holds a line open", () => {
    expect(read("а", ["BR"])).toBe("а");
    expect(read(["DIV", "а", ["BR"]], ["DIV", "б"])).toBe("а\nб");
    expect(read(["DIV", ["STRONG", "а", ["BR"]]], ["DIV", "б"])).toBe(
      "<strong>а</strong>\nб",
    );
  });

  it("keeps a real blank line at the end of a block", () => {
    expect(read(["DIV", "а", ["BR"], ["BR"]], ["DIV", "б"])).toBe("а\n\nб");
  });

  it("understands <b> and font-weight, and a weight that cancels bold", () => {
    expect(read(["B", "а"])).toBe("<strong>а</strong>");
    expect(read({ tag: "SPAN", weight: "700", children: ["а"] })).toBe(
      "<strong>а</strong>",
    );
    expect(
      read(["STRONG", "а", { tag: "SPAN", weight: "normal", children: ["б"] }]),
    ).toBe("<strong>а</strong>б");
  });

  it("keeps nothing but words, lines and bold", () => {
    expect(read(["EM", "а"], ["A", "б"], ["U", ["STRONG", "в"]])).toBe(
      "аб<strong>в</strong>",
    );
  });

  it("turns the editor's non-breaking spaces into spaces", () => {
    expect(read("а б")).toBe("а б");
  });

  it("gives nothing for an empty editor", () => {
    expect(read()).toBe("");
    expect(read(["BR"])).toBe("");
    expect(read(["DIV", ["BR"]])).toBe("");
  });

  it("round-trips through the editor's starting content", () => {
    // The fake DOM mirrors what richTextToEditorHtml emits for this value.
    const value = "а\n<strong>б</strong>\n\nв";
    expect(richTextToEditorHtml(value)).toBe(
      "а<br><strong>б</strong><br><br>в",
    );
    expect(read("а", ["BR"], ["STRONG", "б"], ["BR"], ["BR"], "в")).toBe(value);
  });
});
