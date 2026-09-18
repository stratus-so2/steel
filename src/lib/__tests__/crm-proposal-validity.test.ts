import { describe, expect, it } from 'vitest'
import {
  defaultProposalValidUntil,
  formatProposalValidity,
  isCrmProposalExpired,
  isProposalValidityPast,
  proposalValidityEnd,
} from '../crm-proposal-validity'

describe('proposalValidityEnd()', () => {
  it('should cover the whole São Paulo day of the given instant', () => {
    // 10/10 12:00 em São Paulo (15:00Z) -> vale até 10/10 23:59:59.999 (-03)
    const end = proposalValidityEnd(new Date('2026-10-10T15:00:00.000Z'))
    expect(end.toISOString()).toBe('2026-10-11T02:59:59.999Z')
  })

  it('should use the São Paulo date even when UTC is already the next day', () => {
    // 10/10 23:30 em São Paulo = 11/10 02:30Z
    const end = proposalValidityEnd(new Date('2026-10-11T02:30:00.000Z'))
    expect(end.toISOString()).toBe('2026-10-11T02:59:59.999Z')
  })
})

describe('defaultProposalValidUntil()', () => {
  it('should add N days and extend to the end of that day', () => {
    const from = new Date('2026-09-18T13:00:00.000Z') // 18/09 10:00 SP
    expect(defaultProposalValidUntil(from, 15).toISOString()).toBe(
      '2026-10-04T02:59:59.999Z',
    )
  })
})

describe('isProposalValidityPast()', () => {
  it('should treat null as no expiry', () => {
    expect(isProposalValidityPast(null)).toBe(false)
  })

  it('should keep the proposal valid during its last day', () => {
    const validUntil = new Date('2026-10-10T15:00:00.000Z')
    expect(
      isProposalValidityPast(validUntil, new Date('2026-10-11T02:00:00.000Z')),
    ).toBe(false)
    expect(
      isProposalValidityPast(validUntil, new Date('2026-10-11T03:00:00.000Z')),
    ).toBe(true)
  })
})

describe('isCrmProposalExpired()', () => {
  const past = new Date('2020-01-01T12:00:00.000Z')
  const now = new Date('2026-09-18T12:00:00.000Z')

  it('should always be expired with the EXPIRED status', () => {
    expect(isCrmProposalExpired({ status: 'EXPIRED', validUntil: null })).toBe(
      true,
    )
  })

  it('should be expired when sent/viewed and the date has passed', () => {
    expect(
      isCrmProposalExpired({ status: 'SENT', validUntil: past }, now),
    ).toBe(true)
    expect(
      isCrmProposalExpired({ status: 'VIEWED', validUntil: past }, now),
    ).toBe(true)
  })

  it('should never expire drafts or answered proposals', () => {
    for (const status of ['DRAFT', 'ACCEPTED', 'REJECTED'] as const) {
      expect(isCrmProposalExpired({ status, validUntil: past }, now)).toBe(
        false,
      )
    }
  })

  it('should never expire a legacy proposal without validity', () => {
    expect(
      isCrmProposalExpired({ status: 'SENT', validUntil: null }, now),
    ).toBe(false)
  })
})

describe('formatProposalValidity()', () => {
  it('should format the São Paulo date', () => {
    expect(formatProposalValidity(new Date('2026-10-11T02:59:59.999Z'))).toBe(
      '10/10/2026',
    )
  })
})
