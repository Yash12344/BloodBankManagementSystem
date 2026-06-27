import type { Config } from "tailwindcss";
import preset from "@bloodline/ui/tailwind-preset";

// The design system lives in the shared preset; the web app only declares what to scan.
const config: Config = {
  presets: [preset],
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
};

export default config;
