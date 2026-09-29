"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { ConfirmDialog } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { formFileBytes, shrinkFormImages } from "@/lib/shrink-image";
import type { ActionResult } from "@/server/admin/types";

type Action = (formData: FormData) => Promise<ActionResult>;

/**
 * What the browser may send in one request. Next refuses a server-action body
 * above `serverActions.bodySizeLimit` (12 MB) before our code runs, and all
 * the owner would see is a generic failure — so the form says it first.
 */
const MAX_REQUEST_FILE_BYTES = 10 * 1024 * 1024;

/**
 * Wraps a server action so every admin mutation gives the same feedback:
 * a spinner while it runs, a toast when it finishes, field errors inline,
 * and a refreshed view on success. The owner is never left guessing whether
 * "Запази" worked.
 */
export function ActionForm({
  action,
  children,
  className,
  onSuccess,
  resetOnSuccess,
  splitFiles,
  id,
}: {
  /**
   * Name of a multi-file input whose files are sent one request each, so
   * selecting twenty photos never runs into the request size limit.
   */
  splitFiles?: string;
  action: Action;
  children:
    | ReactNode
    | ((state: {
        pending: boolean;
        fieldErrors: Record<string, string>;
      }) => ReactNode);
  className?: string;
  onSuccess?: (result: ActionResult) => void;
  resetOnSuccess?: boolean;
  id?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  // State lands a render later, so a fast double click would slip past
  // `pending`; the ref closes that gap synchronously.
  const inFlight = useRef(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const submit = useCallback(
    async (formData: FormData) => {
      setPending(true);
      setFieldErrors({});
      try {
        // Phone photos are downscaled in the browser first — see
        // `src/lib/shrink-image.ts`. Forms without files pass straight through.
        const payload =
          formFileBytes(formData) > 0
            ? await shrinkFormImages(formData)
            : formData;

        const result = splitFiles
          ? await runPerFile(action, payload, splitFiles)
          : formFileBytes(payload) > MAX_REQUEST_FILE_BYTES
            ? null
            : await action(payload);

        if (!result) {
          toast.error(
            "Снимките са твърде много за едно качване. Изберете по-малко наведнъж и качете останалите след това.",
          );
          return;
        }
        if (result.ok) {
          toast.success(result.message);
          if (resetOnSuccess) formRef.current?.reset();
          onSuccess?.(result);
          router.refresh();
        } else {
          toast.error(result.message);
          setFieldErrors(result.fieldErrors ?? {});
        }
      } catch (error) {
        console.error(error);
        toast.error(
          "Действието не беше изпълнено. Проверете връзката и опитайте отново.",
        );
      } finally {
        setPending(false);
      }
    },
    [action, onSuccess, resetOnSuccess, router, splitFiles, toast],
  );

  return (
    <form
      id={id}
      ref={formRef}
      // onSubmit rather than `action`: React resets a form after an action
      // runs, even a failed one, which silently reverted whatever the owner
      // had corrected. Clearing is opt-in through `resetOnSuccess`.
      onSubmit={(event) => {
        event.preventDefault();
        if (inFlight.current) return;
        inFlight.current = true;
        void submit(new FormData(event.currentTarget)).finally(() => {
          inFlight.current = false;
        });
      }}
      className={className}
      noValidate
    >
      {typeof children === "function"
        ? children({ pending, fieldErrors })
        : children}
    </form>
  );
}

/**
 * Sends each file of `field` in its own request, alongside the form's other
 * fields, and folds the outcomes into one result.
 */
async function runPerFile(
  action: Action,
  formData: FormData,
  field: string,
): Promise<ActionResult> {
  const files = formData
    .getAll(field)
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (files.length <= 1) return action(formData);

  let uploaded = 0;
  const problems: string[] = [];

  for (const file of files) {
    const single = new FormData();
    for (const [name, value] of formData.entries()) {
      if (name !== field) single.append(name, value);
    }
    single.append(field, file);

    try {
      const result = await action(single);
      if (result.ok) uploaded += 1;
      else problems.push(result.message);
    } catch {
      problems.push(`${file.name}: връзката прекъсна.`);
    }
  }

  if (problems.length === 0) {
    return { ok: true, message: `Качени са ${uploaded} снимки.` };
  }
  return {
    ok: false,
    message:
      uploaded > 0
        ? `Качени са ${uploaded} от ${files.length} снимки. ${problems.join(" ")}`
        : problems.join(" "),
  };
}

export function SubmitButton({
  children,
  pending,
  variant = "primary",
  className,
  disabled,
}: {
  children: ReactNode;
  pending?: boolean;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
  disabled?: boolean;
}) {
  const variants = {
    primary: "bg-ink text-paper hover:bg-cocoa",
    secondary: "border border-line bg-paper hover:bg-surface-sunk",
    danger: "bg-danger text-paper hover:brightness-95",
  };

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-[3px] px-4 text-[0.86rem] font-semibold transition-colors disabled:opacity-60",
        variants[variant],
        className,
      )}
    >
      {pending ? (
        <Loader2 size={15} aria-hidden="true" className="animate-spin" />
      ) : null}
      {children}
    </button>
  );
}

/**
 * A one-button form guarded by a confirmation dialog — used for every
 * destructive admin action.
 */
export function ConfirmAction({
  action,
  hiddenFields,
  label,
  title,
  message,
  confirmLabel,
  variant = "danger",
  className,
}: {
  action: Action;
  hiddenFields: Record<string, string>;
  label: ReactNode;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const formData = new FormData();
      for (const [key, value] of Object.entries(hiddenFields)) {
        formData.set(key, value);
      }
      const result = await action(formData);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Действието не беше изпълнено.");
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  const variants = {
    primary: "bg-ink text-paper hover:bg-cocoa",
    secondary: "border border-line bg-paper hover:bg-surface-sunk",
    danger: "border border-danger/30 bg-danger-soft text-danger hover:brightness-97",
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex min-h-10 items-center justify-center gap-2 rounded-[3px] px-4 text-[0.86rem] font-semibold transition-colors",
          variants[variant],
          className,
        )}
      >
        {label}
      </button>

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={run}
        title={title}
        message={message}
        confirmLabel={confirmLabel}
        destructive={variant === "danger"}
        busy={busy}
      />
    </>
  );
}

/** A form that runs an action with no visible fields (single button). */
export function QuickAction({
  action,
  hiddenFields,
  label,
  variant = "secondary",
  className,
}: {
  action: Action;
  hiddenFields: Record<string, string>;
  label: ReactNode;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
}) {
  return (
    <ActionForm action={action} className="inline-block">
      {({ pending }) => (
        <>
          {Object.entries(hiddenFields).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
          <SubmitButton pending={pending} variant={variant} className={className}>
            {label}
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

/**
 * Runs an action from a single button without rendering a `<form>` around it,
 * so it can sit inside another form — HTML forbids nesting them, and the
 * image controls live inside the product form.
 */
export function InlineAction({
  action,
  hiddenFields,
  label,
  title,
  className,
  disabled,
}: {
  action: Action;
  hiddenFields: Record<string, string>;
  label: ReactNode;
  title?: string;
  className?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const formData = new FormData();
      for (const [key, value] of Object.entries(hiddenFields)) {
        formData.set(key, value);
      }
      const result = await action(formData);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Действието не беше изпълнено.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy || disabled}
      title={title}
      className={cn(
        "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-[3px] border border-line bg-paper px-3 text-[0.78rem] font-semibold transition-colors hover:border-ink disabled:opacity-60",
        className,
      )}
    >
      {busy ? (
        <Loader2 size={13} aria-hidden="true" className="animate-spin" />
      ) : null}
      {label}
    </button>
  );
}
