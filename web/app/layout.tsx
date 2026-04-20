import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LILA Journeys — Player Behavior Viz",
  description:
    "Visualize player journeys, combat, loot, and storm events on LILA BLACK maps.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-text font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
