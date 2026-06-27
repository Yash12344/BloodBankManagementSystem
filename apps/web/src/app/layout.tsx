import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BloodLine — Blood Bank Management",
  description: "Run your blood bank without paperwork.",
};

export const viewport: Viewport = {
  themeColor: "#E53935",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
