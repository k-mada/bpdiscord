import React, { createContext, useContext, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon } from "@heroicons/react/24/solid";
import { cn } from "../lib/utils";

type Placement = "center" | "bottom";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  placement?: Placement;
  /** Use when the dialog has no ModalHeader to name it. */
  label?: string;
}

interface ModalHeaderProps {
  children: React.ReactNode;
  className?: string;
  onClose: () => void;
}

interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
}

const TitleIdContext = createContext<string | undefined>(undefined);

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

const PLACEMENT: Record<Placement, { wrapper: string; panel: string }> = {
  center: {
    wrapper: "items-center justify-center p-4",
    panel: "max-w-lg w-full max-h-[90vh] rounded-md border border-letterboxd-border",
  },
  bottom: {
    wrapper: "items-end justify-center",
    panel: "w-full max-w-lg max-h-[85vh] rounded-t-2xl animate-slide-up",
  },
};

const Modal = ({
  isOpen,
  onClose,
  children,
  className = "",
  placement = "center",
  label,
}: ModalProps) => {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;

      // Wrap at the ends; focus leaving the panel entirely is the failure mode.
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const root = document.getElementById("root");
    const originalOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    // inert blocks pointer and focus in browsers; aria-hidden is what screen
    // readers and jsdom-based tests actually observe.
    root?.setAttribute("aria-hidden", "true");
    root?.setAttribute("inert", "");
    panelRef.current?.focus();

    return () => {
      document.documentElement.style.overflow = originalOverflow;
      root?.removeAttribute("aria-hidden");
      root?.removeAttribute("inert");
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const { wrapper, panel } = PLACEMENT[placement];

  const modalContent = (
    <div className={cn("fixed inset-0 z-50 flex", wrapper)}>
      <div
        className="absolute inset-0 bg-black opacity-50"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "relative bg-letterboxd-bg-primary shadow-letterboxd-lg flex flex-col",
          panel,
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-labelledby={label ? undefined : titleId}
      >
        <TitleIdContext.Provider value={titleId}>
          {children}
        </TitleIdContext.Provider>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

const ModalHeader = ({
  children,
  onClose,
  className = "",
}: ModalHeaderProps) => {
  const titleId = useContext(TitleIdContext);
  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 sm:px-6 py-4 border-b border-letterboxd-border shrink-0",
        className,
      )}
    >
      <h2 id={titleId} className="text-lg sm:text-xl text-letterboxd-text-primary">
        {children}
      </h2>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="flex items-center justify-center -mr-2 p-2 text-letterboxd-text-primary hover:text-letterboxd-text-secondary transition-colors"
      >
        <XMarkIcon className="w-5 h-5" />
      </button>
    </div>
  );
};

const ModalBody = ({ children, className = "" }: ModalBodyProps) => {
  return (
    <div
      className={cn(
        "px-4 sm:px-6 py-4 text-letterboxd-text-primary overflow-y-auto flex-1 min-h-0",
        className,
      )}
    >
      {children}
    </div>
  );
};

export { Modal, ModalHeader, ModalBody };
