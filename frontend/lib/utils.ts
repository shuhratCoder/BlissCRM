import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Qidiruv: matn bo'yicha oddiy mos kelish; so'rov faqat raqamlardan iborat bo'lsa,
// probel, "+", "-" va qavslarsiz solishtiriladi ("2301" -> "+998 97 677 23 01").
export function matchesSearch(
  fields: Array<string | null | undefined>,
  query: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true

  const hays = fields.map((f) => (f ?? '').toLowerCase())
  if (hays.some((h) => h.includes(q))) return true

  if (!/^[\d\s+\-()]+$/.test(q)) return false

  const qDigits = q.replace(/\D/g, '')
  if (!qDigits) return false

  return hays.some((h) => h.replace(/\D/g, '').includes(qDigits))
}
