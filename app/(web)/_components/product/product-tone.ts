import type { ProductTone } from '@/src/schemas/web-product-page.schema'

/**
 * The only place the product pages pick a color for a state. Visuals receive a
 * semantic tone from the content config and map it here, so no page or visual
 * builds its own color classes.
 */
export const PRODUCT_TONE_DOT: Record<ProductTone, string> = {
  neutral: 'bg-muted-foreground/60',
  brand: 'bg-brand',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-sky-500',
}

export const PRODUCT_TONE_SOFT: Record<ProductTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  brand: 'bg-brand/10 text-brand',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  danger: 'bg-red-500/10 text-red-600 dark:text-red-400',
  info: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
}

export const PRODUCT_TONE_TEXT: Record<ProductTone, string> = {
  neutral: 'text-foreground',
  brand: 'text-brand',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-red-600 dark:text-red-400',
  info: 'text-sky-600 dark:text-sky-400',
}
