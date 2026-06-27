import type { Config } from "tailwindcss";

// Design tokens from docs/WIREFRAMES.md. Extended into the full shadcn theme in Phase 3.
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "#E53935",
          hover: "#C62828",
          soft: "#FDECEA",
        },
      },
      borderRadius: {
        card: "16px",
      },
      boxShadow: {
        card: "0 4px 12px rgba(0,0,0,0.06)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
