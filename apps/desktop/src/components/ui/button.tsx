import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({ className, variant = "primary", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-accent text-white shadow-glow hover:bg-violet-500",
        variant === "secondary" && "border border-borderSoft bg-panelSoft text-slate-100 hover:bg-slate-800",
        variant === "ghost" && "text-slate-300 hover:bg-panelSoft hover:text-white",
        variant === "danger" && "bg-rose-600 text-white hover:bg-rose-500",
        className
      )}
      {...props}
    />
  );
}
