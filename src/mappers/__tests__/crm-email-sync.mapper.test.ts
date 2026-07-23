import { describe, expect, it } from 'vitest'
import {
  createFakeCrmCalendarEvent,
  createFakeCrmEmailAccount,
  createFakeCrmEmailMessage,
} from '@/src/__tests__/factories/crm-email-sync.factory'
import {
  toCrmCalendarEventDTO,
  toCrmEmailAccountDTO,
  toCrmEmailMessageDTO,
} from '../crm-email-sync.mapper'

describe('toCrmEmailAccountDTO()', () => {
  it('should map all fields correctly', () => {
    const account = createFakeCrmEmailAccount({
      id: 'a-1',
      provider: 'OUTLOOK',
    })
    const dto = toCrmEmailAccountDTO(account)
    expect(dto.id).toBe('a-1')
    expect(dto.provider).toBe('OUTLOOK')
  })
})

describe('toCrmEmailMessageDTO()', () => {
  it('should map all fields correctly', () => {
    const message = createFakeCrmEmailMessage({ id: 'm-1' })
    expect(toCrmEmailMessageDTO(message).id).toBe('m-1')
  })
})

describe('toCrmCalendarEventDTO()', () => {
  it('should map all fields correctly', () => {
    const event = createFakeCrmCalendarEvent({ id: 'e-1', title: 'Demo' })
    const dto = toCrmCalendarEventDTO(event)
    expect(dto.id).toBe('e-1')
    expect(dto.title).toBe('Demo')
  })
})
