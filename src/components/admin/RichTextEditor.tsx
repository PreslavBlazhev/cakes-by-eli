"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { cn } from "@/lib/cn";
import {
  normalizeRichText,
  richTextFromDom,
  richTextToEditorHtml,
} from "@/lib/rich-text";

/**
 * A multi-line text box with one button: bold.
 *
 * `execCommand` is deprecated, but it is still the only way to get the
 * browser's own selection handling and Ctrl+Z history without pulling in an
 * editor library for a single button. What it produces is never trusted: the
 * markup is read back through `richTextFromDom` into a hidden field, so the
 * form submits like any other and only words, line breaks and bold survive.
 */
export function RichTextEditor({
  name,
  defaultValue,
  label,
  invalid,
}: {
  name: string;
  defaultValue: string;
  label: string;
  invalid?: boolean;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const lastRange = useRef<Range | null>(null);
  const [bold, setBold] = useState(false);

  // Fixed at mount: after a save the page refreshes with the stored text, which
  // must not rebuild the box under the owner's cursor.
  const [initialHtml] = useState(() => ({
    __html: richTextToEditorHtml(defaultValue),
  }));
  // Controlled: React rewrites a hidden input's `defaultValue` on every render,
  // which would put the old text back the moment the button changed state.
  const [value, setValue] = useState(() => normalizeRichText(defaultValue));

  const sync = () => {
    if (editorRef.current) setValue(richTextFromDom(editorRef.current));
  };

  const selectionInEditor = useCallback(() => {
    const selection = document.getSelection();
    const editor = editorRef.current;
    if (!selection?.rangeCount || !editor) return null;
    return editor.contains(selection.anchorNode) &&
      editor.contains(selection.focusNode)
      ? selection
      : null;
  }, []);

  useEffect(() => {
    const onSelectionChange = () => {
      const selection = selectionInEditor();
      if (!selection) {
        if (document.activeElement !== buttonRef.current) setBold(false);
        return;
      }
      lastRange.current = selection.getRangeAt(0).cloneRange();
      setBold(document.queryCommandState("bold"));
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", onSelectionChange);
  }, [selectionInEditor]);

  const toggleBold = () => {
    const editor = editorRef.current;
    if (!editor) return;

    // Reaching the button with Tab moves the focus out of the box, so the
    // owner's selection has to be put back before it can be formatted.
    const selectionKept = selectionInEditor() !== null;
    if (document.activeElement !== editor) editor.focus();
    if (!selectionKept && lastRange.current) {
      const selection = document.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(lastRange.current);
    }

    document.execCommand("styleWithCSS", false, "false");
    document.execCommand("bold");
    sync();
    setBold(document.queryCommandState("bold"));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey) {
      // `code`, not `key`: on a Bulgarian layout the same key types „б“ or „ф“.
      if (event.code === "KeyB") {
        event.preventDefault();
        toggleBold();
      } else if (event.code === "KeyI" || event.code === "KeyU") {
        // The browser would apply them, and the save would silently drop them.
        event.preventDefault();
      }
      return;
    }

    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      document.execCommand("insertLineBreak");
      sync();
    }
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--radius-sm)] border border-line bg-paper",
        "transition-[border-color,box-shadow] duration-200",
        "focus-within:border-rose-dark focus-within:ring-[3px] focus-within:ring-rose-dark/12",
        invalid && "border-danger ring-danger/15",
      )}
    >
      <div
        role="toolbar"
        aria-label="Форматиране"
        className="flex items-center gap-1 border-b border-line bg-surface-sunk/45 px-2 py-1.5"
      >
        <button
          ref={buttonRef}
          type="button"
          title="Удебелен текст"
          aria-label="Удебелен текст"
          aria-pressed={bold}
          // Without this the press takes the focus and collapses the selection.
          onMouseDown={(event) => event.preventDefault()}
          onClick={toggleBold}
          className={cn(
            "inline-flex size-9 items-center justify-center rounded-[3px] border text-[0.95rem] font-extrabold transition-colors",
            bold
              ? "border-ink bg-ink text-paper"
              : "border-line bg-paper text-ink hover:border-ink",
          )}
        >
          B
        </button>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        aria-invalid={invalid || undefined}
        dangerouslySetInnerHTML={initialHtml}
        onInput={sync}
        onKeyDown={onKeyDown}
        onBlur={(event) => {
          if (event.relatedTarget !== buttonRef.current) setBold(false);
        }}
        onPaste={(event) => {
          // Pasted from Word or a website, the styling would show here and be
          // gone after saving. Taking only the text keeps what is seen honest.
          event.preventDefault();
          document.execCommand(
            "insertText",
            false,
            event.clipboardData.getData("text/plain"),
          );
          sync();
        }}
        onDrop={(event) => event.preventDefault()}
        className="max-h-[32rem] min-h-32 overflow-y-auto whitespace-pre-wrap break-words px-4 py-3 text-ink outline-none [&_b]:font-bold [&_strong]:font-bold"
      />

      <input type="hidden" name={name} value={value} />
    </div>
  );
}
