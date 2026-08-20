"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { ConfirmDialog } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import type { ActionResult } from "@/server/admin/types";

type Action = (formData: FormData) => Promise<ActionResult>;

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
  id,
}: {
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const submit = useCallback(
    async (formData: FormData) => {
      setPending(true);
      setFieldErrors({});
      try {
        const result = await action(formData);
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
    [action, onSuccess, resetOnSuccess, router, toast],
  );

  return (
    <form
      id={id}
      ref={formRef}
      action={submit}
      className={className}
      noValidate
    >
      {typeof children === "function"
        ? children({ pending, fieldErrors })
        : children}
    </form>
  );
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
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 text-[0.86rem] font-semibold transition-colors disabled:opacity-60",
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
          "inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 text-[0.86rem] font-semibold transition-colors",
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
