import { parseRichText } from "@/lib/rich-text";

/** A stored description, as React text: no markup in it can reach the page. */
export function RichText({ value }: { value: string }) {
  return parseRichText(value).map(({ text, bold }, index) =>
    bold ? (
      <strong key={index} className="font-bold text-ink">
        {text}
      </strong>
    ) : (
      <span key={index}>{text}</span>
    ),
  );
}
