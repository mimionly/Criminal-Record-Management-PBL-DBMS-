import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility to merge Tailwind CSS classes cleanly, resolving styling conflicts.
 * Essential for custom Shadcn UI component wrappers.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
