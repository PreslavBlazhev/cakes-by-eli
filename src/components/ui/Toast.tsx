"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

import { cn } from "@/lib/cn";

type ToastTone = "success" | "error" | "info";

type Toast = {
  id: number;
  tone: ToastTone;
  message: string;
};

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      counter += 1;
      const id = counter;
      setToasts((current) => [...current, { id, tone, message }]);
      window.setTimeout(() => dismiss(id), tone === "error" ? 8000 : 4500);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push("success", message),
      error: (message) => push("error", message),
      info: (message) => push("info", message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[300] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end"
      >
        {toasts.map((toast) => (
          <ToastRow key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastRow({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  const tones: Record<ToastTone, string> = {
    success: "border-[#cfdcc6] bg-positive-soft text-positive",
    error: "border-[#eecccd] bg-danger-soft text-danger",
    info: "border-line bg-paper text-ink",
  };
  const Icon =
    toast.tone === "success"
      ? CheckCircle2
      : toast.tone === "error"
        ? AlertTriangle
        : Info;

  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      className={cn(
        "fade-up pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-[var(--radius-sm)] border px-4 py-3 shadow-[var(--shadow-card)]",
        tones[toast.tone],
      )}
    >
      <Icon size={17} aria-hidden="true" className="mt-0.5 flex-none" />
      <p className="flex-1 text-[0.88rem] font-medium leading-snug">
        {toast.message}
      </p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Затвори известието"
        className="-mr-1 flex size-6 flex-none items-center justify-center rounded-full transition-opacity hover:opacity-70"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast трябва да се използва вътре в <ToastProvider>.");
  }
  return ctx;
}
