import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function formatTimestampUTC(ms: number, style: 'short' | 'full' = 'short'): string {
  const d = new Date(ms)
  const M = d.getUTCMonth() + 1
  const D = d.getUTCDate()
  const h = String(d.getUTCHours()).padStart(2, '0')
  const m = String(d.getUTCMinutes()).padStart(2, '0')
  if (style === 'short') return `${M}/${D} ${h}:${m}`
  const Y = d.getUTCFullYear()
  return `${Y}.${String(M).padStart(2, '0')}.${String(D).padStart(2, '0')} ${h}:${m} UTC`
}
