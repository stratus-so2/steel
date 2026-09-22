import type { SdCustomFieldType } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import {
  createFakeSdTicket,
  createFakeSdUserSummary,
} from '@/src/__tests__/factories/sd-ticket.factory'
import { createFakeSdCustomField } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import {
  applySdTemplateDefaults,
  buildSdTicketFacts,
  diffSdTickets,
  sdFieldLabel,
  sdMissingRequiredFields,
  sdTemplateTasks,
  sdTicketRowFacts,
  validateSdTicketCustomFields,
} from '../sd-ticket-rules'

describe('sdFieldLabel', () => {
  it('labels known, custom and unknown fields', () => {
    expect(sdFieldLabel('assigneeId')).toBe('Responsável')
    expect(sdFieldLabel('customFields.contrato')).toBe('contrato')
    expect(sdFieldLabel('foo')).toBe('foo')
  })
})

describe('applySdTemplateDefaults', () => {
  it('fills only undefined keys with non-empty strings and merges custom fields', () => {
    const out = applySdTemplateDefaults(
      { title: 'Meu', categoryId: undefined, customFields: { a: 1 } } as {
        title?: string
        categoryId?: string
        priorityId?: string
        severityId?: string
        customFields?: Record<string, unknown>
      },
      {
        title: 'Do modelo',
        categoryId: 'c1',
        priorityId: '',
        severityId: 3,
        customFields: { a: 0, b: 2 },
      },
    )
    expect(out).toEqual({
      title: 'Meu',
      categoryId: 'c1',
      customFields: { a: 1, b: 2 },
    })
  })

  it('ignores non-object defaults and keeps input without custom fields', () => {
    expect(applySdTemplateDefaults({ title: 'x' }, null)).toEqual({
      title: 'x',
    })
    expect(applySdTemplateDefaults({ title: 'x' }, ['a'])).toEqual({
      title: 'x',
    })
  })

  it('uses only template custom fields when input has none', () => {
    expect(applySdTemplateDefaults({}, { customFields: { k: 'v' } })).toEqual({
      customFields: { k: 'v' },
    })
  })
})

describe('sdTemplateTasks', () => {
  it('keeps valid tasks, trims and drops malformed ones', () => {
    expect(sdTemplateTasks('x')).toEqual([])
    expect(
      sdTemplateTasks([
        { title: ' Verificar ', description: 'd' },
        { title: '' },
        { title: 3 },
        null,
        { title: 'Sem descrição', description: 5 },
      ]),
    ).toEqual([
      { title: 'Verificar', description: 'd' },
      { title: 'Sem descrição', description: null },
    ])
  })
})

describe('buildSdTicketFacts', () => {
  it('fills defaults and extracts text from the description', () => {
    expect(buildSdTicketFacts({ type: 'INCIDENT' })).toMatchObject({
      type: 'INCIDENT',
      channel: null,
      tags: [],
      escalationLevel: 0,
      description: null,
      customFields: {},
    })
    const facts = buildSdTicketFacts({
      type: 'CHANGE',
      description: '<p>Olá <b>mundo</b></p>',
      customFields: { a: 1 },
      tags: ['vip'],
      escalationLevel: 2,
    })
    expect(facts.description).toBe('Olá mundo')
    expect(facts.customFields).toEqual({ a: 1 })
  })

  it('builds facts from a persisted row', () => {
    const t = createFakeSdTicket({
      priority: { id: 'p', name: 'P1', level: 4, color: null },
    })
    expect(sdTicketRowFacts(t)).toMatchObject({
      phaseCategory: 'NEW',
      priorityLevel: 4,
    })
    expect(sdTicketRowFacts(createFakeSdTicket()).priorityLevel).toBeNull()
  })
})

describe('sdMissingRequiredFields', () => {
  it('detects blank plain and custom fields', () => {
    expect(
      sdMissingRequiredFields(
        [
          'solution',
          'assigneeId',
          'tags',
          'title',
          'customFields.a',
          'customFields.b',
          'knownError',
        ],
        {
          solution: '  ',
          assigneeId: null,
          tags: [],
          title: 'x',
          knownError: false,
          customFields: { a: 'ok' },
        },
      ),
    ).toEqual(['solution', 'assigneeId', 'tags', 'customFields.b'])
    expect(sdMissingRequiredFields(['customFields.a'], {})).toEqual([
      'customFields.a',
    ])
  })
})

describe('validateSdTicketCustomFields', () => {
  const opts = {
    type: 'INCIDENT' as const,
    categoryIds: [],
    checkRequired: false,
  }
  const def = (type: SdCustomFieldType, extra = {}) =>
    createFakeSdCustomField({ key: 'f', label: 'Campo', type, ...extra })
  const options = [{ value: 'a' }, { value: 'b' }, { nope: 1 }, 'x']

  it.each([
    ['TEXT', 'x', true],
    ['TEXT', 1, false],
    ['TEXTAREA', 'x'.repeat(10_001), false],
    ['PHONE', '+55 11 99999-0000', true],
    ['USER', 'u1', true],
    ['NUMBER', 3, true],
    ['NUMBER', Number.NaN, false],
    ['CURRENCY', 'abc', false],
    ['DATE', '2026-09-21', true],
    ['DATETIME', 'nope', false],
    ['DATE', 5, false],
    ['CHECKBOX', true, true],
    ['CHECKBOX', 'true', false],
    ['SELECT', 'a', true],
    ['SELECT', 'z', false],
    ['SELECT', 1, false],
    ['MULTI_SELECT', ['a', 'b'], true],
    ['MULTI_SELECT', ['a', 'z'], false],
    ['MULTI_SELECT', 'a', false],
    ['EMAIL', 'a@b.co', true],
    ['EMAIL', 'nope', false],
    ['EMAIL', 3, false],
    ['URL', 'https://x.io/a', true],
    ['URL', 'ftp://x', false],
    ['URL', 1, false],
  ] as const)('%s %j → %s', (type, value, valid) => {
    const result = validateSdTicketCustomFields(
      [def(type, { options })],
      { f: value },
      opts,
    )
    if (valid) expect(expectOk(result)).toEqual({ f: value })
    else expectErr(result, 'SD_CUSTOM_FIELD_INVALID')
  })

  it('handles non-array options', () => {
    expectErr(
      validateSdTicketCustomFields(
        [def('SELECT', { options: {} })],
        { f: 'a' },
        opts,
      ),
      'SD_CUSTOM_FIELD_INVALID',
    )
  })

  it('rejects unknown keys and drops cleared values', () => {
    const e = expectErr(
      validateSdTicketCustomFields([def('TEXT')], { x: 1 }, opts),
      'SD_CUSTOM_FIELD_INVALID',
    )
    expect(e.message).toContain('x')
    expect(
      expectOk(
        validateSdTicketCustomFields(
          [def('TEXT'), createFakeSdCustomField({ key: 'g' })],
          { f: null, g: '' },
          opts,
        ),
      ),
    ).toEqual({})
  })

  it('enforces applicable required fields', () => {
    const defs = [
      createFakeSdCustomField({ key: 'a', label: 'A', required: true }),
      createFakeSdCustomField({
        key: 'b',
        label: 'B',
        required: true,
        ticketTypes: ['CHANGE'],
      }),
      createFakeSdCustomField({
        key: 'c',
        label: 'C',
        required: true,
        ticketTypes: ['INCIDENT'],
        categoryIds: ['cat1'],
      }),
      createFakeSdCustomField({
        key: 'd',
        label: 'D',
        required: true,
        categoryIds: ['cat2'],
      }),
    ]
    const e = expectErr(
      validateSdTicketCustomFields(
        defs,
        {},
        {
          type: 'INCIDENT',
          categoryIds: ['cat1', null, undefined],
          checkRequired: true,
        },
      ),
      'SD_CUSTOM_FIELD_INVALID',
    )
    expect(e.message).toBe('A é obrigatório')
    expect(
      (e.details as { issues: { key: string }[] }).issues.map((i) => i.key),
    ).toEqual(['a', 'c'])
    expect(
      expectOk(
        validateSdTicketCustomFields(
          defs,
          { a: 'x', c: 'y' },
          {
            type: 'INCIDENT',
            categoryIds: ['cat1'],
            checkRequired: true,
          },
        ),
      ),
    ).toEqual({ a: 'x', c: 'y' })
  })
})

describe('diffSdTickets', () => {
  it('reports relation labels, scalars, dates, rich text and custom fields', () => {
    const user = createFakeSdUserSummary({ id: 'u2', name: 'Bia' })
    const before = createFakeSdTicket({
      title: 'A',
      description: '<p>velho</p>',
      tags: ['x'],
      customFields: { a: 1, b: 2, d: 5 },
      plannedStartAt: null,
      solution: null,
    })
    const after = createFakeSdTicket({
      ...before,
      title: 'B',
      description: '<p>novo <b>texto</b></p>',
      assigneeId: 'u2',
      assignee: user,
      phaseId: 'p2',
      phase: { ...before.phase, id: 'p2', name: 'Em andamento' },
      parentId: 'par',
      parent: { id: 'par', number: 7, title: 'Pai', type: 'PROBLEM' },
      plannedStartAt: new Date('2026-09-22T00:00:00.000Z'),
      customFields: { a: 1, b: 3, c: 4 },
      tags: ['x'],
      solution: 'feito',
    })
    const changes = diffSdTickets(before, after, [
      'title',
      'description',
      'assigneeId',
      'phaseId',
      'parentId',
      'plannedStartAt',
      'customFields',
      'tags',
      'solution',
      'priorityId',
    ])
    expect(changes).toEqual([
      { field: 'title', from: 'A', to: 'B' },
      { field: 'description', from: 'velho', to: 'novo texto' },
      { field: 'assigneeId', from: null, to: { id: 'u2', label: 'Bia' } },
      {
        field: 'phaseId',
        from: { id: before.phase.id, label: 'Novo' },
        to: { id: 'p2', label: 'Em andamento' },
      },
      { field: 'parentId', from: null, to: { id: 'par', label: '#7' } },
      { field: 'plannedStartAt', from: null, to: '2026-09-22T00:00:00.000Z' },
      { field: 'customFields.b', from: 2, to: 3 },
      { field: 'customFields.d', from: 5, to: null },
      { field: 'customFields.c', from: null, to: 4 },
      { field: 'solution', from: null, to: 'feito' },
    ])
  })

  it('covers every relation label and non-object custom fields', () => {
    const ref = { id: 'r', name: 'R' }
    const level = { id: 'r', name: 'R', level: 1 }
    const before = createFakeSdTicket({ customFields: [] as never })
    const after = createFakeSdTicket({
      ...before,
      customFields: null as never,
      impactId: 'r',
      impact: level,
      urgencyId: 'r',
      urgency: level,
      priorityId: 'r',
      priority: { ...level, color: null },
      severityId: 'r',
      severity: { ...level, color: null },
      categoryId: 'r',
      category: ref,
      subcategoryId: 'r',
      subcategory: ref,
      serviceId: 'r',
      service: ref,
      classificationId: 'r',
      classification: { ...ref, color: null },
      solutionClassificationId: 'r',
      solutionClassification: { ...ref, color: null },
      customerId: 'r',
      customer: { ...ref, tradeName: null, document: null },
      companyId: 'r',
      company: { ...ref, tradeName: null, document: null },
      contactId: 'r',
      contact: { ...ref, email: null, phone: null, userId: null },
      configItemId: 'r',
      configItem: { ...ref, code: null },
      departmentId: 'r',
      department: { ...ref, color: null },
      requesterId: 'r',
      requester: createFakeSdUserSummary({ id: 'r', name: 'R' }),
    })
    const fields = [
      'impactId',
      'urgencyId',
      'priorityId',
      'severityId',
      'categoryId',
      'subcategoryId',
      'serviceId',
      'classificationId',
      'solutionClassificationId',
      'customerId',
      'companyId',
      'contactId',
      'configItemId',
      'departmentId',
      'requesterId',
      'customFields',
    ]
    const changes = diffSdTickets(before, after, fields)
    expect(changes).toHaveLength(15)
    for (const c of changes) expect(c.to).toEqual({ id: 'r', label: 'R' })
    // e o caminho inverso (relação removida → null)
    expect(diffSdTickets(after, before, ['impactId'])).toEqual([
      { field: 'impactId', from: { id: 'r', label: 'R' }, to: null },
    ])
  })
})
