import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Compose className strings. tailwind-merge resolves conflicting Tailwind
// utilities so callers can override base styles by passing their own classes;
// the last conflicting class wins.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
