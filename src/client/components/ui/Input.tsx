import type { InputHTMLAttributes, Ref } from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  ref?: Ref<HTMLInputElement>;
}

// Base styles inline rather than referencing the .input-field CSS class so
// tailwind-merge can resolve conflicting utility classes when callers pass
// their own className. .input-field still exists in index.css for legacy
// callers (cleanup in bpdiscord-3h2).
const baseClasses =
  "bg-letterboxd-bg-secondary border border-letterboxd-border rounded-md " +
  "px-4 py-3 text-letterboxd-text-primary placeholder-letterboxd-text-muted " +
  "focus:outline-hidden focus:ring-2 focus:ring-letterboxd-accent focus:border-transparent " +
  "transition-all duration-200 " +
  "disabled:opacity-50 disabled:cursor-not-allowed " +
  "aria-invalid:border-red-500 aria-invalid:focus:ring-red-500";

export function Input({ className, ref, ...props }: InputProps) {
  return <input ref={ref} className={cn(baseClasses, className)} {...props} />;
}
