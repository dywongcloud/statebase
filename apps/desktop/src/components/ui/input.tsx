import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("w-full rounded-xl border border-borderSoft bg-panelSoft px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-accent", className)} {...props} />;
}
