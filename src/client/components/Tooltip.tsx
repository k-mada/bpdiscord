import React, {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useReducer,
  useRef,
  useState,
} from "react";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  className?: string;
}

interface TriggerState {
  hovered: boolean;
  focused: boolean;
  dismissed: boolean;
}

type TriggerEvent =
  | "hoverIn"
  | "hoverOut"
  | "focusIn"
  | "focusOut"
  | "dismiss";

const TRANSITIONS: Record<TriggerEvent, (s: TriggerState) => TriggerState> = {
  hoverIn: (s) => ({ ...s, hovered: true }),
  hoverOut: (s) => ({ ...s, hovered: false }),
  focusIn: (s) => ({ ...s, focused: true }),
  focusOut: (s) => ({ ...s, focused: false }),
  dismiss: (s) => ({ ...s, dismissed: true }),
};

// 1.4.13 persistent: hover and focus are independent, so losing one while the
// other holds must not hide anything. Esc re-arms once both are gone.
const reduceTrigger = (s: TriggerState, event: TriggerEvent): TriggerState => {
  const next = TRANSITIONS[event](s);
  return { ...next, dismissed: next.dismissed && (next.hovered || next.focused) };
};

const IDLE: TriggerState = { hovered: false, focused: false, dismissed: false };

const Tooltip = ({ content, children, className = "" }: TooltipProps) => {
  const [trigger, dispatch] = useReducer(reduceTrigger, IDLE);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();

  const isVisible = (trigger.hovered || trigger.focused) && !trigger.dismissed;

  const open =
    (event: "hoverIn" | "focusIn") =>
    (e: React.MouseEvent | React.FocusEvent) => {
      dispatch(event);
      updatePosition(e);
    };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isVisible) {
      updatePosition(e);
    }
  };

  const updatePosition = (e: React.MouseEvent | React.FocusEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const tooltipWidth = tooltipRef.current?.offsetWidth || 0;
    const tooltipHeight = tooltipRef.current?.offsetHeight || 0;

    let x = rect.left + rect.width / 2 - tooltipWidth / 2;
    // Fixed vertical position - always show above the element with consistent spacing
    let y = rect.top - tooltipHeight - 12;

    // Ensure tooltip doesn't go off screen horizontally
    const padding = 8;
    if (x < padding) x = padding;
    if (x + tooltipWidth > window.innerWidth - padding) {
      x = window.innerWidth - tooltipWidth - padding;
    }

    // If there's not enough room above, show below with consistent spacing
    if (y < padding) {
      y = rect.bottom + 12;
    }

    setPosition({ x, y });
  };

  // Document-level, not on the wrapper: hover can open this while focus is
  // elsewhere, and 1.4.13 requires Esc to dismiss it from there too.
  useEffect(() => {
    if (!isVisible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") dispatch("dismiss");
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isVisible]);

  // Tooltip does not own the trigger, so aria-describedby cannot live on the
  // wrapper — it has to land on the focusable child itself.
  const describedTrigger = isValidElement<{ "aria-describedby"?: string }>(
    children,
  )
    ? cloneElement(children, { "aria-describedby": tooltipId })
    : children;

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={open("hoverIn")}
      onMouseLeave={() => dispatch("hoverOut")}
      onMouseMove={handleMouseMove}
      onFocus={open("focusIn")}
      onBlur={() => dispatch("focusOut")}
    >
      {describedTrigger}
      <div
        ref={tooltipRef}
        id={tooltipId}
        role="tooltip"
        className={`fixed z-50 px-3 py-2 text-sm text-letterboxd-text-primary bg-letterboxd-bg-primary border border-letterboxd-border rounded-md shadow-letterboxd-lg pointer-events-none transition-opacity duration-300 max-w-xs ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          visibility: isVisible ? "visible" : "hidden",
        }}
      >
        <div className="wrap-break-word lowercase">{content}</div>
        {/* Tooltip arrow */}
        <div
          className="absolute w-2 h-2 bg-letterboxd-bg-primary border-b border-r border-letterboxd-border transform rotate-45"
          style={{
            left: "50%",
            bottom: "-4px",
            transform: "translateX(-50%) rotate(45deg)",
          }}
        />
      </div>
    </div>
  );
};

export default Tooltip;
