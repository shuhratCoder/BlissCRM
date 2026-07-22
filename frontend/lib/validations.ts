// lib/validations.ts
// Zod schema factories — call with the active t() so messages are localized.

import { z } from 'zod'

type T = (key: string, vars?: Record<string, string | number>) => string

// ── Auth ─────────────────────────────────────────────────────
export const buildLoginSchema = (t: T) =>
  z.object({
    username: z.string().min(2, t('val.username')),
    password: z.string().min(4, t('val.minChars', { n: 4 })),
  })

export type LoginFormData = z.infer<ReturnType<typeof buildLoginSchema>>

// ── Product ──────────────────────────────────────────────────
// buildProductSchema ichiga narx maydonini qo'shib qo'ying:
export const buildProductSchema = (t: any) => z.object({
  name: z.string().min(1, t('common.required')),
  amount: z.number().min(0),
  unit: z.string(),
  type: z.string(),
  description: z.string().optional(),
  price: z.number().or(z.string().transform(() => undefined)).optional(), // 💡 Ixtiyoriy narx
});


export type ProductFormData = z.infer<ReturnType<typeof buildProductSchema>>

// ── Product purchase (restock) ───────────────────────────────
export const buildPurchaseSchema = (t: T) =>
  z.object({
    productId: z.string().min(1, t('val.chooseProduct')),
    amount: z
      .number({ invalid_type_error: t('val.enterNumber') })
      .int(t('val.integer'))
      .positive(t('val.amountPositive')),
  })

export type PurchaseFormData = z.infer<ReturnType<typeof buildPurchaseSchema>>

// ── Client (mebel backend) ──────────────────────────────────
// description replaces note; phone canonical +998XXXXXXXXX.
export const buildClientSchema = (t: T) =>
  z.object({
    name: z
      .string()
      .min(2, t('val.minChars', { n: 2 }))
      .max(200, t('val.maxChars', { n: 200 })),
    phone: z.string().regex(/^\+998\d{9}$/, t('val.phoneFormat')),
    description: z
      .string()
      .max(500, t('val.maxChars', { n: 500 }))
      .optional()
      .or(z.literal('')),
  })

export type ClientFormData = z.infer<ReturnType<typeof buildClientSchema>>

