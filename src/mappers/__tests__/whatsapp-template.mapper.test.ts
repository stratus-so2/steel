import { describe, expect, it } from 'vitest'
import { createFakeWhatsAppTemplate } from '@/src/__tests__/factories/whatsapp-template.factory'
import { toWhatsAppTemplateDTO } from '../whatsapp-template.mapper'

describe('toWhatsAppTemplateDTO()', () => {
  it('should map all fields correctly', () => {
    const template = createFakeWhatsAppTemplate({
      id: 't1',
      name: 'boas_vindas',
      status: 'APPROVED',
      components: [{ type: 'BODY', text: 'Bem-vindo!' }],
    })

    const dto = toWhatsAppTemplateDTO(template)

    expect(dto.id).toBe('t1')
    expect(dto.name).toBe('boas_vindas')
    expect(dto.status).toBe('APPROVED')
    expect(dto.components).toEqual([{ type: 'BODY', text: 'Bem-vindo!' }])
  })

  it('should default components to an empty array when malformed', () => {
    const template = createFakeWhatsAppTemplate({
      components: 'not-an-array' as unknown as never,
    })

    const dto = toWhatsAppTemplateDTO(template)

    expect(dto.components).toEqual([])
  })
})
