import { useEffect, useRef } from "react";
import { EventCategory } from "../../types";
import { formatNominee } from "./utils";

interface NomineesModalProps {
  category: EventCategory;
  onClose: () => void;
}

const NomineesModal = ({ category, onClose }: NomineesModalProps) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      onClick={onClose}
      role="dialog"
      aria-label={`${category.name} nominees`}
    >
      <div
        className="w-full max-w-lg bg-letterboxd-bg-secondary rounded-t-2xl p-5 pb-8 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3
            className="text-lg font-bold text-letterboxd-pro"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {category.name}
          </h3>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="text-letterboxd-text-muted hover:text-letterboxd-text-primary text-2xl leading-none px-2"
          >
            &times;
          </button>
        </div>
        <p className="text-[10px] uppercase tracking-widest text-letterboxd-text-muted mb-3">
          Nominees
        </p>
        <ul className="space-y-2">
          {category.nominees.map((nominee) => {
            const { primary, secondary } = formatNominee(nominee, category.displayMode);
            return (
              <li
                key={nominee.id}
                className="text-sm text-letterboxd-text-primary border-b border-letterboxd-border/30 pb-2 last:border-0"
              >
                {primary}
                {secondary && (
                  <span className="text-letterboxd-text-muted">
                    {" "}
                    &mdash; {secondary}
                  </span>
                )}
                {nominee.isWinner && (
                  <span className="ml-2 text-letterboxd-pro text-xs font-semibold">
                    Winner
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default NomineesModal;
