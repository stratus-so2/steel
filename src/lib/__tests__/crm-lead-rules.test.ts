import { describe, expect, it } from 'vitest'
import {
  computeLeadScore,
  findLeadRoutingOwner,
  matchesLeadRule,
} from '../crm-lead-rules'

const subject = {
  name: 'Jane Doe',
  emails: ['jane@acme.com'],
  phones: [],
  company: 'Acme',
  jobTitle: null,
  source: 'ads',
  city: null,
}

describe('matchesLeadRule()', () => {
  it('should match equals', () => {
    expect(
      matchesLeadRule(subject, {
        field: 'source',
        operator: 'equals',
        value: 'ads',
      }),
    ).toBe(true)
  })

  it('should match contains', () => {
    expect(
      matchesLeadRule(subject, {
        field: 'email',
        operator: 'contains',
        value: 'acme',
      }),
    ).toBe(true)
  })

  it('should match is_empty for an absent field', () => {
    expect(
      matchesLeadRule(subject, {
        field: 'jobTitle',
        operator: 'is_empty',
        value: null,
      }),
    ).toBe(true)
  })

  it('should match is_not_empty for a present field', () => {
    expect(
      matchesLeadRule(subject, {
        field: 'company',
        operator: 'is_not_empty',
        value: null,
      }),
    ).toBe(true)
  })

  it('should not match not_equals when values are equal', () => {
    expect(
      matchesLeadRule(subject, {
        field: 'source',
        operator: 'not_equals',
        value: 'ads',
      }),
    ).toBe(false)
  })
})

describe('computeLeadScore()', () => {
  it('should sum points from all matching active rules', () => {
    const score = computeLeadScore(subject, [
      {
        field: 'source',
        operator: 'equals',
        value: 'ads',
        points: 10,
        active: true,
      },
      {
        field: 'email',
        operator: 'contains',
        value: 'acme',
        points: 5,
        active: true,
      },
      {
        field: 'city',
        operator: 'is_not_empty',
        value: null,
        points: 20,
        active: true,
      },
    ])
    expect(score).toBe(15)
  })

  it('should ignore inactive rules', () => {
    const score = computeLeadScore(subject, [
      {
        field: 'source',
        operator: 'equals',
        value: 'ads',
        points: 10,
        active: false,
      },
    ])
    expect(score).toBe(0)
  })
})

describe('findLeadRoutingOwner()', () => {
  it('should return the owner of the first matching active rule', () => {
    const owner = findLeadRoutingOwner(subject, [
      {
        field: 'city',
        operator: 'equals',
        value: 'SP',
        ownerId: 'u1',
        active: true,
      },
      {
        field: 'source',
        operator: 'equals',
        value: 'ads',
        ownerId: 'u2',
        active: true,
      },
    ])
    expect(owner).toBe('u2')
  })

  it('should return null when no rule matches', () => {
    const owner = findLeadRoutingOwner(subject, [
      {
        field: 'city',
        operator: 'equals',
        value: 'SP',
        ownerId: 'u1',
        active: true,
      },
    ])
    expect(owner).toBeNull()
  })
})
