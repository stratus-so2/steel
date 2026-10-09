import type { CrmEmailBrandInput } from '@/src/schemas/crm-email-builder.schema'

export type EmailBrand = CrmEmailBrandInput

/** Steel's default accent (react-email Barebone "brand"). */
export const DEFAULT_PRIMARY_COLOR = '#2893CC'

/** Workspace branding with fallbacks: no saved row → workspace name/logo. */
export function resolveEmailBrand(
  saved: Partial<EmailBrand> | null,
  workspace: { name: string; logoUrl: string | null },
): EmailBrand {
  return {
    companyName: saved?.companyName?.trim() || workspace.name,
    logoUrl: saved?.logoUrl ?? workspace.logoUrl ?? '',
    primaryColor: saved?.primaryColor || DEFAULT_PRIMARY_COLOR,
    address: saved?.address ?? '',
    website: saved?.website ?? '',
  }
}

function channels(hex: string): [number, number, number] {
  const value = hex.replace('#', '')
  return [0, 2, 4].map((i) => Number.parseInt(value.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ]
}

/** Relative luminance (WCAG) of a #RRGGBB color. */
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Text color readable on top of `hex` (white or near-black). */
export function readableTextOn(hex: string): string {
  return luminance(hex) > 0.45 ? '#14171E' : '#FFFFFF'
}

/** Mixes `hex` with white — `ratio` 0 = white, 1 = the color itself. */
export function tint(hex: string, ratio: number): string {
  return `#${channels(hex)
    .map((c) =>
      Math.round(255 - (255 - c) * ratio)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}
