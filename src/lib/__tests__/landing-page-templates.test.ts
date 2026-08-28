import { describe, expect, it } from 'vitest'
import { SECTION_REGISTRY } from '@/app/_components/crm/landing-page/sections/registry'
import { LANDING_PAGE_TEMPLATE_CATALOG } from '@/src/lib/landing-page-templates'
import { CrmLandingPageSectionContentSchema } from '@/src/schemas/crm-landing-page-section.schema'

/**
 * Guarda de regressão: protege o catálogo de templates de divergir do schema
 * ou da registry de componentes conforme novos templates são adicionados
 * (2-10). Cada seção default precisa validar no Zod, e cada tipo usado
 * precisa ter um componente registrado.
 */
describe('LANDING_PAGE_TEMPLATE_CATALOG', () => {
  for (const template of Object.values(LANDING_PAGE_TEMPLATE_CATALOG)) {
    describe(`template "${template.key}"`, () => {
      it('should have at least one section', () => {
        expect(template.sections.length).toBeGreaterThan(0)
      })

      for (const [index, section] of template.sections.entries()) {
        it(`section [${index}] (${section.type}) should have a registered component`, () => {
          expect(SECTION_REGISTRY[section.type]).toBeDefined()
        })

        it(`section [${index}] (${section.type}) default content should validate against the schema`, () => {
          const result = CrmLandingPageSectionContentSchema.safeParse(
            section.content,
          )
          expect(result.success).toBe(true)
        })

        it(`section [${index}] (${section.type}) content.type should match the section type`, () => {
          expect(section.content.type).toBe(section.type)
        })
      }
    })
  }
})
