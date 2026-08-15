import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "../../lib/cn";
import { AlertIcon, CheckIcon, CloseIcon } from "./icons";

type ToastTone = "success" | "error" | "info";

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastValue {
  show: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

const TONE_STYLES: Record<ToastTone, string> = {
  success: "border-accent-line",
  error: "border-danger-line",
  info: "border-line-strong",
};

const TONE_ICON: Record<ToastTone, string> = {
  success: "text-accent",
  error: "text-danger",
  info: "text-faint",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, tone: ToastTone = "success") => {
      const id = nextId.current++;
      setToasts((list) => [...list, { id, tone, message }]);
      setTimeout(() => dismiss(id), 4_000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "animate-rise pointer-events-auto flex w-full max-w-sm items-start gap-3",
              "rounded-lg border bg-surface px-4 py-3 shadow-pop",
              TONE_STYLES[toast.tone],
            )}
          >
            <span className={cn("mt-0.5 shrink-0", TONE_ICON[toast.tone])}>
              {toast.tone === "error" ? (
                <AlertIcon className="size-4" />
              ) : (
                <CheckIcon className="size-4" />
              )}
            </span>
            <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-text">
              {toast.message}
            </p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="-m-1 shrink-0 rounded p-1 text-faint transition-colors duration-150 hover:text-text"
              aria-label="Dismiss notification"
            >
              <CloseIcon className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- hook đi liền provider
export function useToast(): ToastValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast phải nằm trong <ToastProvider>");
  return value;
}
