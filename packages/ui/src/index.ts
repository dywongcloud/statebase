import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const statebaseTheme = {
  radius: "0.75rem",
  colors: {
    background: "#060816",
    panel: "#0b1021",
    panelSoft: "#11172f",
    border: "#26304f",
    text: "#e5ecff",
    muted: "#94a3b8",
    accent: "#8b5cf6"
  }
};
