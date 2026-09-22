import { describe, expect, it } from 'vitest'
import {
  evaluateSdCondition,
  evaluateSdConditions,
} from '@/src/lib/servicedesk/conditions'
import type { SdCondition } from '@/src/schemas/sd-rule.schema'

const facts = {
  type: 'INCIDENT',
  priorityId: 'p1',
  priorityLevel: 3,
  escalationLevel: 0,
  title: 'Servidor de E-mail fora do ar',
  description: null,
  assigneeId: undefined,
  tags: ['vip', 'rede'],
  createdAt: new Date('2026-09-21T12:00:00Z'),
  customFields: {
    contrato: 'GOLD',
    horas: '12',
    ativo: true,
    inativo: false,
    vazio: {},
  },
}

const c = (
  field: string,
  operator: SdCondition['operator'],
  value?: SdCondition['value'],
) => ({ field, operator, value }) as SdCondition

describe('evaluateSdCondition', () => {
  it.each([
    [c('type', 'equals', 'INCIDENT'), true],
    [c('type', 'equals', 'CHANGE'), false],
    [c('priorityLevel', 'equals', '3'), true],
    [c('assigneeId', 'equals', 'x'), false],
    [c('assigneeId', 'equals', null), false],
    [c('tags', 'equals', 'vip'), true],
    [c('tags', 'equals', 'outro'), false],
    [c('type', 'not_equals', 'CHANGE'), true],
    [c('tags', 'not_equals', 'vip'), false],
    [c('type', 'in', ['INCIDENT', 'PROBLEM']), true],
    [c('type', 'in', ['CHANGE']), false],
    [c('tags', 'in', ['x', 'rede']), true],
    [c('tags', 'in', ['x']), false],
    [c('priorityId', 'in', 'p1'), true],
    [c('type', 'not_in', ['CHANGE']), true],
    [c('tags', 'not_in', ['vip']), false],
    [c('title', 'contains', 'e-MAIL'), true],
    [c('title', 'contains', 'impressora'), false],
    [c('tags', 'contains', 'rede'), true],
    [c('description', 'contains', 'x'), false],
    [c('title', 'contains', null), false],
    [c('createdAt', 'contains', '2026-09-21'), true],
    [c('description', 'is_empty'), true],
    [c('assigneeId', 'is_empty'), true],
    [c('title', 'is_empty'), false],
    [c('tags', 'is_empty'), false],
    [c('customFields.vazio', 'is_empty'), true],
    [c('customFields.ativo', 'is_empty'), false],
    [c('createdAt', 'is_empty'), false],
    [c('title', 'is_not_empty'), true],
    [c('customFields.contrato', 'equals', 'GOLD'), true],
    [c('customFields.inexistente', 'is_empty'), true],
    [c('priorityLevel', 'gt', 2), true],
    [c('priorityLevel', 'gt', 3), false],
    [c('priorityLevel', 'lt', '4'), true],
    [c('customFields.horas', 'gt', 10), true],
    [c('customFields.ativo', 'gt', 0), true],
    [c('customFields.inativo', 'lt', 1), true],
    [c('createdAt', 'gt', '2026-09-20T00:00:00Z'), true],
    [c('createdAt', 'lt', '2026-09-20T00:00:00Z'), false],
    [c('title', 'gt', 1), false],
    [c('description', 'lt', 1), false],
    [c('priorityLevel', 'gt', ''), false],
    [c('escalationLevel', 'lt', Number.NaN), false],
  ])('%j → %s', (condition, expected) => {
    expect(evaluateSdCondition(condition, facts)).toBe(expected)
  })

  it('handles facts without customFields', () => {
    expect(
      evaluateSdCondition(c('customFields.x', 'is_empty'), { type: 'CHANGE' }),
    ).toBe(true)
    expect(
      evaluateSdCondition(c('customFields.x', 'is_empty'), {
        customFields: null,
      }),
    ).toBe(true)
  })

  it('treats non-finite numbers as not comparable', () => {
    expect(
      evaluateSdCondition(c('n', 'gt', 1), { n: Number.POSITIVE_INFINITY }),
    ).toBe(false)
  })
})

describe('evaluateSdConditions', () => {
  it('matches an empty list', () => {
    expect(evaluateSdConditions([], facts)).toBe(true)
  })

  it('requires every condition (AND)', () => {
    expect(
      evaluateSdConditions(
        [c('type', 'equals', 'INCIDENT'), c('tags', 'in', ['vip'])],
        facts,
      ),
    ).toBe(true)
    expect(
      evaluateSdConditions(
        [c('type', 'equals', 'INCIDENT'), c('tags', 'in', ['x'])],
        facts,
      ),
    ).toBe(false)
  })
})
