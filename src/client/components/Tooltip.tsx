import React, { useState, useRef, useEffect } from "react";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  className?: string;
}

const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  className = "",
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = (e: React.MouseEvent) => {
    setIsVisible(true);
    updatePosition(e);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isVisible) {
      updatePosition(e);
    }
  };

  const updatePosition = (e: React.MouseEvent) => {
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

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
    >
      {children}

      <div
        ref={tooltipRef}
        className={`fixed z-50 px-3 py-2 text-sm text-letterboxd-text-primary bg-letterboxd-bg-primary border border-letterboxd-border rounded-md shadow-letterboxd-lg pointer-events-none transition-opacity duration-300 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          visibility: isVisible ? "visible" : "hidden",
        }}
      >
        <div className="whitespace-nowrap">{content}</div>
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
