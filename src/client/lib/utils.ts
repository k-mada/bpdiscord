import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// tailwind-merge resolves conflicting utilities, so a caller's class beats the
// base style it collides with.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
