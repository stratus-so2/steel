import type { CrmEmailBrand } from '@prisma/client'
import type { EmailBrand } from '@/src/lib/crm-email-builder/brand'
import type { EmailLinkTargets } from '@/src/repositories/crm-email-builder.repository'
import type {
  CrmEmailBrandDTO,
  CrmEmailLinkTargetsDTO,
} from '@/types/crm-email-marketing'

/** Resolved brand (with defaults) + whether the workspace saved one. */
export function toCrmEmailBrandDTO(
  brand: EmailBrand,
  saved: CrmEmailBrand | null,
): CrmEmailBrandDTO {
  return {
    ...brand,
    saved: saved !== null,
    updatedAt: saved ? saved.updatedAt.toISOString() : null,
  }
}

/** Public URLs of the link picker quick picks (`/l/<token>`, `/f/<token>`). */
export function toCrmEmailLinkTargetsDTO(
  targets: EmailLinkTargets,
  baseUrl: string,
): CrmEmailLinkTargetsDTO {
  const base = baseUrl.replace(/\/$/, '')
  return {
    landingPages: targets.landingPages.map((page) => ({
      id: page.id,
      title: page.title,
      url: `${base}/l/${page.shareToken}`,
    })),
    forms: targets.forms.map((form) => ({
      id: form.id,
      name: form.name,
      url: `${base}/f/${form.publicToken}`,
    })),
  }
}
