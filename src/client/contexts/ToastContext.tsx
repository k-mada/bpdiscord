import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ToastNotification } from "../components/ui/ToastNotification";
import type { Tone } from "../components/ui/tone";

const AUTO_DISMISS_MS = 5000;

interface ToastOptions {
  tone: Tone;
  message: string;
}

interface ToastApi {
  show: (options: ToastOptions) => void;
  dismiss: () => void;
}

interface ActiveToast extends ToastOptions {
  id: number;
}

const ToastContext = createContext<ToastApi | null>(null);

/**
 * Owns the app's single global toast: the one fired from an action handler to
 * confirm a result whose own UI has gone (a closed dialog, a removed row).
 * Distinct from ui/Notification, which renders inline and persists while its
 * condition holds. A new toast replaces the current one — no stacking.
 *
 * Success/info auto-dismiss after 5s; errors persist until dismissed. The timer
 * pauses while the pointer or focus is on the toast (WCAG 2.2.1).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ActiveToast | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const nextId = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  // Errors have no timer — they stay until the user dismisses them.
  const startTimer = useCallback(
    (tone: Tone) => {
      clearTimer();
      if (tone === "error") return;
      timerRef.current = window.setTimeout(() => setToast(null), AUTO_DISMISS_MS);
    },
    [clearTimer],
  );

  const dismiss = useCallback(() => {
    clearTimer();
    setToast(null);
  }, [clearTimer]);

  const show = useCallback(
    ({ tone, message }: ToastOptions) => {
      nextId.current += 1;
      setToast({ tone, message, id: nextId.current });
      startTimer(tone);
    },
    [startTimer],
  );

  const pause = useCallback(() => clearTimer(), [clearTimer]);
  const resume = useCallback(() => {
    if (toast) startTimer(toast.tone);
  }, [toast, startTimer]);

  // Esc dismisses without moving the pointer — a hovering user holds no focus,
  // so the listener lives on document.
  useEffect(() => {
    if (!toast) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [toast, dismiss]);

  useEffect(() => clearTimer, [clearTimer]);

  const api = useMemo<ToastApi>(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex justify-center px-4">
        {toast && (
          <div className="w-full max-w-md">
            <ToastNotification
              key={toast.id}
              tone={toast.tone}
              message={toast.message}
              onDismiss={dismiss}
              onPause={pause}
              onResume={resume}
            />
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return api;
}
