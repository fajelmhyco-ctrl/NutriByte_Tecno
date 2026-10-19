import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NutriByte Philippines | Dietitian Portal",
  description: "Remote patient monitoring and tele-nutrition for Filipino clinical dietetics",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
