import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Class merging helper expected by shadcn-style components (Motion-Primitives). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
