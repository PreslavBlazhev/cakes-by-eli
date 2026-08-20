"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";

import { cn } from "@/lib/cn";
import { formatBytes } from "@/lib/format";

const ACCEPT = "image/jpeg,image/png,image/webp";

/**
 * Reference-image picker.
 *
 * Client-side checks are for fast feedback only — the server re-validates type
 * by magic bytes and enforces the same limits before anything is written.
 */
export function AttachmentPicker({
  files,
  onChange,
  maxFiles,
  maxFileMb,
  error,
}: {
  files: File[];
  onChange: (next: File[]) => void;
  maxFiles: number;
  maxFileMb: number;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // Object URLs are derived from the current selection and released as soon as
  // that selection changes, so no blob outlives the preview that uses it.
  const previews = useMemo(
    () => files.map((file) => URL.createObjectURL(file)),
    [files],
  );

  useEffect(
    () => () => previews.forEach((url) => URL.revokeObjectURL(url)),
    [previews],
  );

  const accept = (incoming: FileList | null) => {
    if (!incoming) return;
    setLocalError(null);

    const next = [...files];
    for (const file of Array.from(incoming)) {
      if (next.length >= maxFiles) {
        setLocalError(`Може да прикачите най-много ${maxFiles} снимки.`);
        break;
      }
      if (!ACCEPT.split(",").includes(file.type)) {
        setLocalError(`„${file.name}“ не е JPG, PNG или WEBP.`);
        continue;
      }
      if (file.size > maxFileMb * 1024 * 1024) {
        setLocalError(`„${file.name}“ е по-голяма от ${maxFileMb} MB.`);
        continue;
      }
      next.push(file);
    }

    onChange(next);
    if (inputRef.current) inputRef.current.value = "";
  };

  const message = error ?? localError;

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(e.dataTransfer.files);
        }}
        className={cn(
          "rounded-[var(--radius-md)] border border-dashed p-5 text-center transition-colors",
          dragging ? "border-rose-dark bg-blush-soft" : "border-line-strong bg-paper",
        )}
      >
        <ImagePlus
          size={22}
          aria-hidden="true"
          className="mx-auto text-rose-dark"
        />
        <p className="mt-2 text-[0.92rem] font-semibold">
          Имаш идея или снимка за вдъхновение?
        </p>
        <p className="mt-1 text-[0.8rem] text-ink-soft">
          Прикачете до {maxFiles} снимки — JPG, PNG или WEBP, до {maxFileMb} MB
          всяка.
        </p>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={files.length >= maxFiles}
          className="mt-4 inline-flex min-h-11 items-center rounded-full border border-ink px-5 text-[0.88rem] font-semibold transition-colors hover:bg-ink hover:text-paper disabled:opacity-50"
        >
          Избери снимки
        </button>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          onChange={(e) => accept(e.target.files)}
        />
      </div>

      {message ? (
        <p className="mt-2 text-[0.78rem] font-semibold text-danger">{message}</p>
      ) : null}

      {files.length > 0 ? (
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="relative overflow-hidden rounded-[var(--radius-sm)] border border-line bg-paper"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previews[index]}
                alt=""
                className="h-24 w-full object-cover"
              />
              <div className="px-2 py-1.5">
                <p className="truncate text-[0.72rem] font-semibold">
                  {file.name}
                </p>
                <p className="text-[0.68rem] text-ink-faint">
                  {formatBytes(file.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, i) => i !== index))}
                aria-label={`Премахни ${file.name}`}
                className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-cocoa/75 text-paper transition-colors hover:bg-cocoa"
              >
                <X size={13} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
