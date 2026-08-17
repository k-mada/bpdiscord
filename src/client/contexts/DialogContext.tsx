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

interface DialogStack {
  open: (id: string) => void;
  close: (id: string) => void;
  isTopmost: (id: string) => boolean;
}

const DialogStackContext = createContext<DialogStack | null>(null);

/**
 * Owns the state a dialog shares with the rest of the app — background hiding,
 * scroll lock, and stacking order. Held here rather than in Modal because all
 * three are global: two dialogs managing them independently means the first to
 * close releases them while the other is still open.
 *
 * Dialogs portal into document.body, so they sit outside the inert container in
 * the DOM while remaining inside it in the React tree, which is what lets
 * context reach them.
 */
export function DialogProvider({ children }: { children: ReactNode }) {
  const [openIds, setOpenIds] = useState<string[]>([]);
  const locked = openIds.length > 0;

  // Read by event handlers, which need the current stack without the identity
  // of isTopmost changing on every open and close.
  const openIdsRef = useRef(openIds);
  useEffect(() => {
    openIdsRef.current = openIds;
  }, [openIds]);

  useEffect(() => {
    if (!locked) return undefined;
    const original = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = original;
    };
  }, [locked]);

  const open = useCallback((id: string) => {
    setOpenIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
  }, []);

  const close = useCallback((id: string) => {
    setOpenIds((ids) => ids.filter((openId) => openId !== id));
  }, []);

  const isTopmost = useCallback(
    (id: string) => openIdsRef.current.at(-1) === id,
    [],
  );

  const stack = useMemo(
    () => ({ open, close, isTopmost }),
    [open, close, isTopmost],
  );

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
