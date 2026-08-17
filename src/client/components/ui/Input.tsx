import type { InputHTMLAttributes, Ref } from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  ref?: Ref<HTMLInputElement>;
}

// Inline rather than the .input-field class so tailwind-merge can resolve
// conflicts when callers pass their own className.
const baseClasses =
  "bg-letterboxd-bg-secondary border border-letterboxd-border-light rounded-md " +
  "px-4 py-3 text-letterboxd-text-primary placeholder-letterboxd-text-muted " +
  "transition-all duration-200 " +
  "disabled:opacity-50 disabled:cursor-not-allowed " +
  "aria-invalid:border-red-500";

export function Input({ className, ref, ...props }: InputProps) {
  return <input ref={ref} className={cn(baseClasses, className)} {...props} />;
}
