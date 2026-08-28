import { SECTION_REGISTRY } from '@/app/_components/crm/landing-page/sections/registry'
import type { CrmLandingPageSectionDTO } from '@/types/crm-landing-page'

/**
 * Render público (somente leitura) das seções de uma landing page —
 * usado tanto na página `/l/[shareToken]` quanto poderia ser reaproveitado
 * num preview futuro. Sem `onChange`/upload: cada seção recebe `readOnly`,
 * que já desliga toda a interação nos componentes de seção.
 */
export function LandingPageWebPreview({
  sections,
}: {
  sections: CrmLandingPageSectionDTO[]
}) {
  return (
    <>
      {sections
        .filter((section) => section.enabled)
        .map((section) => {
          const definition = SECTION_REGISTRY[section.type]
          if (!definition) return null
          const { Component } = definition
          return (
            <Component key={section.id} content={section.content} readOnly />
          )
        })}
    </>
  )
}
