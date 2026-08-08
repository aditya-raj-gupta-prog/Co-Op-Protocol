"use client";

import {createContext, useCallback, useContext, useMemo, useRef, useState} from "react";

export type ToastVariant = "info" | "pending" | "success" | "error";

export interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Milliseconds before auto-dismiss. Set to 0 to require manual dismissal. */
  duration?: number;
}

interface ToastRecord extends Required<Omit<ToastInput, "description">> {
  id: number;
  description?: string;
}

interface ToastContextValue {
  push: (toast: ToastInput) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Record<ToastVariant, string> = {
  info: "border-zinc-700 bg-zinc-900 text-zinc-100",
  pending: "border-cyan-800 bg-cyan-950/60 text-cyan-100",
  success: "border-emerald-800 bg-emerald-950/60 text-emerald-100",
  error: "border-red-800 bg-red-950/60 text-red-100",
};

const VARIANT_ICON: Record<ToastVariant, string> = {
  info: "ℹ",
  pending: "⏳",
  success: "✓",
  error: "✕",
};

export function ToastProvider({children}: {children: React.ReactNode}) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    ({title, description, variant = "info", duration = 6000}: ToastInput) => {
      const id = nextId.current++;
      setToasts((current) => [...current, {id, title, description, variant, duration}]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  const value = useMemo(() => ({push, dismiss}), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm ${VARIANT_STYLES[toast.variant]}`}
          >
            <span className="mt-0.5 text-sm">{VARIANT_ICON[toast.variant]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-tight">{toast.title}</p>
              {toast.description ? (
                <p className="mt-1 break-words text-xs leading-snug text-zinc-400">{toast.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="text-zinc-500 transition hover:text-zinc-300"
              aria-label="Dismiss notification"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within a ToastProvider");
  return context;
}
