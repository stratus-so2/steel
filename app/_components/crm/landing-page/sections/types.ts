import type { CrmLandingPageSectionContent } from '@/src/schemas/crm-landing-page-section.schema'

/**
 * Um único componente por tipo de seção — ao contrário de propostas
 * (Editor + Display separados), aqui o mesmo componente é o preview E o
 * editor: `readOnly` desliga a interação (usado no link público), sem
 * chrome/painel lateral. Edição acontece direto em cima do render via
 * GhostInput/GhostTextarea/GhostImage.
 *
 * `onChange`/`workspaceId` são opcionais porque o preview público
 * (`LandingPageWebPreview`) é um Server Component: passar uma função como
 * prop pra um Client Component (as seções são `'use client'`) quebra a
 * serialização RSC ("Event handlers cannot be passed to Client Component
 * props"). Em modo `readOnly`, os componentes nunca chamam `onChange` de
 * verdade — os handlers internos só disparam a partir de elementos que
 * `readOnly` já desliga (GhostInput/GhostTextarea/GhostImage não renderizam
 * nada interativo nesse modo).
 */
export type LandingPageSectionProps<
  T extends CrmLandingPageSectionContent = CrmLandingPageSectionContent,
> = {
  content: T
  onChange?: (content: T) => void
  workspaceId?: string
  readOnly?: boolean
}
