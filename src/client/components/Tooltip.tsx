import React, {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();

  const isVisible = (trigger.hovered || trigger.focused) && !trigger.dismissed;

  const reposition = useCallback(() => {
    const wrapper = wrapperRef.current;
    const tooltip = tooltipRef.current;
    if (!wrapper || !tooltip) return;

    const rect = wrapper.getBoundingClientRect();
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;

    let x = rect.left + rect.width / 2 - tooltipWidth / 2;
    let y = rect.top - tooltipHeight - 12;

    const padding = 8;
    if (x < padding) x = padding;
    if (x + tooltipWidth > window.innerWidth - padding) {
      x = window.innerWidth - tooltipWidth - padding;
    }
    // Flip below when there is no room above
    if (y < padding) {
      y = rect.bottom + 12;
    }

    setPosition({ x, y });
  }, []);

  // Tab scrolls an off-screen trigger into view after focus fires, and a fixed
  // popup does not travel with the scroll — so measure post-layout, not on event.
  useLayoutEffect(() => {
    if (!isVisible) return;
    reposition();
    // capture phase so a scrolling ancestor, not just the window, counts
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [isVisible, reposition]);

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
      ref={wrapperRef}
      onMouseEnter={() => dispatch("hoverIn")}
      onMouseLeave={() => dispatch("hoverOut")}
      onFocus={() => dispatch("focusIn")}
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
