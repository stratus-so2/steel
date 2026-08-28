import type { CrmLandingPageSectionContent } from '@/src/schemas/crm-landing-page-section.schema'

/**
 * Um único componente por tipo de seção — ao contrário de propostas
 * (Editor + Display separados), aqui o mesmo componente é o preview E o
 * editor: `readOnly` desliga a interação (usado no link público), sem
 * chrome/painel lateral. Edição acontece direto em cima do render via
 * GhostInput/GhostTextarea/GhostImage.
 */
export type LandingPageSectionProps<
  T extends CrmLandingPageSectionContent = CrmLandingPageSectionContent,
> = {
  content: T
  onChange: (content: T) => void
  workspaceId: string
  readOnly?: boolean
}
