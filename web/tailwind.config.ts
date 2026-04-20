import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg:       "#0b0d11",
        panel:    "#13171e",
        panel2:   "#1a1f28",
        border:   "#262c38",
        text:     "#e7eaf0",
        muted:    "#8b93a7",
        accent:   "#38bdf8",
        human:    "#38bdf8",
        bot:      "#f87171",
        kill:     "#facc15",
        death:    "#ef4444",
        storm:    "#a855f7",
        loot:     "#22c55e",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo"],
      },
    },
  },
  plugins: [],
} satisfies Config;
