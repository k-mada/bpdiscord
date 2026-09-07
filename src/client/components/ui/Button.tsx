import type { ButtonHTMLAttributes, Ref } from "react";
import { cn } from "../../lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Implies disabled, sets aria-busy, and swaps a spinner in ahead of children. */
  loading?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

// Inline rather than the .btn-* utilities so tailwind-merge can resolve
// conflicts when callers pass their own className.
const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium " +
  "cursor-pointer transition-colors duration-200 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-letterboxd-accent hover:bg-letterboxd-accent-hover text-black",
  secondary:
    "bg-letterboxd-bg-secondary hover:bg-letterboxd-bg-tertiary " +
    "text-letterboxd-text-primary border border-letterboxd-border",
  ghost:
    "bg-transparent text-letterboxd-text-muted hover:text-letterboxd-text-primary",
  destructive:
    "bg-transparent text-letterboxd-error hover:underline",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "py-1 px-3 text-sm",
  md: "py-2 px-4",
  icon: "h-11 w-11 p-0",
};

/** Button styling without the element — for a link that should look like a button. */
export function buttonVariants({
  variant = "primary",
  size = "md",
}: { variant?: ButtonVariant; size?: ButtonSize } = {}) {
  return cn(baseClasses, variantClasses[variant], sizeClasses[size]);
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  className,
  ref,
  ...props
}: ButtonProps) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {loading && (
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-b-transparent"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}
