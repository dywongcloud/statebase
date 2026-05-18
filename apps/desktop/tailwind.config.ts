import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#060816",
        panel: "#0b1021",
        panelSoft: "#11172f",
        borderSoft: "#26304f",
        accent: "#8b5cf6"
      },
      boxShadow: {
        glow: "0 0 60px rgba(139, 92, 246, 0.2)"
      }
    }
  },
  plugins: []
} satisfies Config;
