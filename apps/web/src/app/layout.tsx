import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";

// Self-hosted Inter (variable). Bundled from a committed woff2 so builds never reach out
// to Google Fonts at build time — fully offline/air-gapped and behind-strict-proxy safe.
const inter = localFont({
  src: "./fonts/inter-latin-wght-normal.woff2",
  variable: "--font-sans",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BloodLine — Blood Bank Management",
  description: "Run your blood bank without paperwork.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#E53935",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
