import { useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/solid";

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const CollapsibleSection = ({
  title,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <h4 className="mb-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="text-letterboxd-text-primary font-semibold">
            {title}
          </span>
          <ChevronDownIcon
            className={`h-5 w-5 text-letterboxd-text-secondary transition-transform ${
              open ? "" : "-rotate-90"
            }`}
          />
        </button>
      </h4>
      {open && <div>{children}</div>}
    </div>
  );
};

export default CollapsibleSection;
