/** @type {import('tailwindcss').Config} */
module.exports = {
  mode: 'jit', // Enable Just-In-Time mode for better performance
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}", 
    "./services/**/*.{js,jsx,ts,tsx}",
    "!./node_modules"
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        // Letterboxd-inspired color palette with light mode variants
        letterboxd: {
          // Dark mode (default)
          "bg-primary": "#1a1d1f", // Main dark background
          "bg-secondary": "#2a2d2f", // Slightly lighter background
          "bg-tertiary": "#3a3d3f", // Even lighter for cards/sections
          "text-primary": "#e0e0e0", // Main text color
          "text-secondary": "#a0a0a0", // Secondary text
          "text-muted": "#808080", // Muted text
          accent: "#42b883", // Letterboxd green
          "accent-hover": "#3aa876", // Darker green for hover
          pro: "#f5c518", // PRO badge gold
          border: "#404040", // Border color
          "border-light": "#505050", // Lighter border
          // Light mode variants
          "bg-primary-light": "#f8f9fa",
          "bg-secondary-light": "#ffffff",
          "bg-tertiary-light": "#f1f3f4",
          "text-primary-light": "#1a1d1f",
          "text-secondary-light": "#6c757d",
          "text-muted-light": "#9ca3af",
          "border-light-mode": "#e5e7eb",
          "border-light-light": "#d1d5db",
        },
      },
      fontFamily: {
        sans: ["Inter", "Roboto", "Arial", "sans-serif"],
      },
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1.5", letterSpacing: "0.05em" }],
        sm: ["0.875rem", { lineHeight: "1.5" }],
        base: ["1rem", { lineHeight: "1.5" }],
        lg: ["1.125rem", { lineHeight: "1.4" }],
        xl: ["1.25rem", { lineHeight: "1.4" }],
        "2xl": ["1.5rem", { lineHeight: "1.3" }],
        "3xl": ["1.875rem", { lineHeight: "1.2" }],
        "4xl": ["2.25rem", { lineHeight: "1.1" }],
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
        "letterboxd-light":
          "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
        "letterboxd-lg-light":
          "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
      },
      transitionDuration: {
        'DEFAULT': '200ms',
        'fast': '150ms',
        'slow': '300ms'
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
        "spin": "spin 1s linear infinite",
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
        spin: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
      utilities: {
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': { display: 'none' }
        }
      }
    },
  },
  plugins: [],
};
