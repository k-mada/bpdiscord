import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface DialogStack {
  open: () => void;
  close: () => void;
}

const DialogStackContext = createContext<DialogStack | null>(null);

/**
 * Owns the state a dialog shares with the rest of the app — background hiding
 * and scroll lock. Held here rather than in Modal because both are global: two
 * dialogs setting them independently means the first to close releases them
 * while the other is still open.
 *
 * Dialogs portal into document.body, so they sit outside the inert container in
 * the DOM while remaining inside it in the React tree, which is what lets
 * context reach them.
 */
export function DialogProvider({ children }: { children: ReactNode }) {
  const [openCount, setOpenCount] = useState(0);
  const locked = openCount > 0;

  useEffect(() => {
    if (!locked) return undefined;
    const original = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = original;
    };
  }, [locked]);

  const open = useCallback(() => setOpenCount((n) => n + 1), []);
  const close = useCallback(() => setOpenCount((n) => Math.max(0, n - 1)), []);
  const stack = useMemo(() => ({ open, close }), [open, close]);

  return (
    <DialogStackContext.Provider value={stack}>
      <div inert={locked || undefined} aria-hidden={locked || undefined}>
        {children}
      </div>
    </DialogStackContext.Provider>
  );
}

export function useDialogStack(): DialogStack {
  const stack = useContext(DialogStackContext);
  if (!stack) {
    throw new Error("useDialogStack must be used within a DialogProvider");
  }
  return stack;
}
