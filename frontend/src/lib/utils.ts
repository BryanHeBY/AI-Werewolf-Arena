
/**
 * 通用样式工具：集中处理 Tailwind 类名合并。
 */
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * 合并动态 class 并消解 Tailwind 冲突类。
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
