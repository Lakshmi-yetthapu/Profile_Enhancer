/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#10141b",
        surface: "#171c26",
        "surface-2": "#1e2531",
        line: "#2a3342",
        body: "#e4e8ef",
        muted: "#94a0b2",
        primary: {
          DEFAULT: "#5b9c93",
          deep: "#3d7a72",
          soft: "#7bb3ab",
        },
        sand: "#caa86a",
        good: "#6fae8f",
        warn: "#c9a25f",
        bad: "#bd7373",
      },
      fontFamily: {
        display: ['"Fraunces"', "Georgia", "serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0,0,0,0.25), 0 8px 24px -12px rgba(0,0,0,0.5)",
        glow: "0 0 0 1px rgba(91,156,147,0.25), 0 12px 40px -16px rgba(91,156,147,0.35)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out both",
      },
    },
  },
  plugins: [],
};
