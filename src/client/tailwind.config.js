/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./services/**/*.{js,jsx,ts,tsx}",
    "!./node_modules/**/*",
  ],
  theme: {
    extend: {
      screens: {
        "max-xs": { max: "480px" },
        "max-sm": { max: "640px" },
        "max-md": { max: "768px" },
        "max-lg": { max: "1024px" },
        "max-xl": { max: "1280px" },
        "max-2xl": { max: "1536px" },
      },
      zIndex: {
        1: "1",
      },
      colors: {
        // Letterboxd-inspired color palette
        letterboxd: {
          "bg-primary": "#14181c", // Main dark background
          "bg-secondary": "#2a2d2f", // Slightly lighter background
          "bg-tertiary": "#2c3440", // Even lighter for cards/sections
          "text-primary": "#e0e0e0", // Main text color
          "text-secondary": "#b8b8b8", // Secondary text
          "text-muted": "#a0a0a0", // Muted text
          accent: "#00ac1c", // Letterboxd green
          "accent-hover": "#009d1a", // Darker green for hover
          pro: "#f5c518", // PRO badge gold
          border: "#404040", // Decorative dividers only — exempt from WCAG 1.4.11
          "border-light": "#8a8a8a", // Control boundaries (inputs, selects) — 1.4.11 needs 3:1
          "link-hover": "#40bcf4", // Link hover color
          // Error text and its border tint. 4.54:1 on bg-tertiary — passes AA
          // with little headroom, so the gate keeps a background tweak honest.
          error: "#f87171",
          // The ground error copy sits on. Deliberately dark: tinting with
          // `error` itself lightens the surface and sinks contrast below AA.
          "error-surface": "#7f1d1d",
          success: "#4ade80",
          // Same dark-ground rule as error-surface: tinting with `success`
          // itself lightens the surface and sinks contrast below AA.
          "success-surface": "#14532d",
          // Same two-token rule as error/success: light text, deliberately dark
          // ground. Both verified before use — see THEME.md for the ratios.
          warning: "#facc15",
          "warning-surface": "#713f12",
          info: "#7dd3fc",
          "info-surface": "#0c4a6e",
        },
      },
      fontFamily: {
        letterboxdBody: ["PT Serif", "serif"],
        sans: ["Be Vietnam Pro", "Roboto", "Arial", "sans-serif"],
      },
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1rem" }],
        sm: ["0.875rem", { lineHeight: "1.25rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.125rem", { lineHeight: "1.75rem" }],
        xl: ["1.25rem", { lineHeight: "1.75rem" }],
        "2xl": ["1.5rem", { lineHeight: "2rem" }],
        "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
        "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
      },
      spacing: {
        18: "4.5rem",
        88: "22rem",
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
      },
      boxShadow: {
        letterboxd:
          "0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)",
        "letterboxd-lg":
          "0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
