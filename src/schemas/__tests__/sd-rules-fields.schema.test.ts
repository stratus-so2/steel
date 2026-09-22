import { describe, expect, it } from 'vitest'
import {
  CreateSdAutomationRuleSchema,
  ListSdAutomationRulesSchema,
  sdAutomationActionRefs,
  UpdateSdAutomationRuleSchema,
} from '../sd-automation-rule.schema'
import {
  CreateSdCustomFieldSchema,
  ListSdCustomFieldsSchema,
  UpdateSdCustomFieldSchema,
} from '../sd-custom-field.schema'
import {
  CreateSdEscalationRuleSchema,
  UpdateSdEscalationRuleSchema,
} from '../sd-escalation-rule.schema'
import type { SdAutomationAction } from '../sd-rule.schema'

describe('escalation rule schemas', () => {
  it('requires thresholdMinutes for NO_UPDATE', () => {
    expect(
      CreateSdEscalationRuleSchema.safeParse({
        name: 'Parado',
        trigger: 'NO_UPDATE',
        actions: {},
      }).success,
    ).toBe(false)
    const parsed = CreateSdEscalationRuleSchema.parse({
      name: 'Parado',
      trigger: 'NO_UPDATE',
      thresholdMinutes: 60,
      actions: {},
    })
    expect(parsed.conditions).toEqual([])
    expect(parsed.active).toBe(true)
    expect(
      CreateSdEscalationRuleSchema.safeParse({
        name: 'Risco',
        trigger: 'RESOLUTION_AT_RISK',
        actions: {},
      }).success,
    ).toBe(true)
  })

  it('requires a field on update', () => {
    expect(UpdateSdEscalationRuleSchema.safeParse({}).success).toBe(false)
    expect(UpdateSdEscalationRuleSchema.parse({ active: false })).toEqual({
      active: false,
    })
  })
})

describe('automation rule schemas', () => {
  const notify = {
    type: 'notify',
    params: { title: 'Oi' },
  }

  it('applies defaults and requires actions', () => {
    const parsed = CreateSdAutomationRuleSchema.parse({
      name: 'Regra',
      event: 'TICKET_CREATED',
      actions: [notify],
    })
    expect(parsed.stopProcessing).toBe(false)
    expect(parsed.conditions).toEqual([])
    expect(
      CreateSdAutomationRuleSchema.safeParse({
        name: 'Regra',
        event: 'TICKET_CREATED',
        actions: [],
      }).success,
    ).toBe(false)
  })

  it('validates update and list', () => {
    expect(UpdateSdAutomationRuleSchema.safeParse({}).success).toBe(false)
    expect(
      UpdateSdAutomationRuleSchema.parse({ event: 'SLA_BREACHED' }),
    ).toEqual({ event: 'SLA_BREACHED' })
    expect(ListSdAutomationRulesSchema.parse({})).toEqual({})
  })

  it('collects referenced ids from every action type', () => {
    const actions = [
      { type: 'assign_department', params: { departmentId: 'd1' } },
      { type: 'round_robin', params: { departmentId: 'd2' } },
      { type: 'round_robin', params: {} },
      { type: 'assign_user', params: { userId: 'u1' } },
      { type: 'add_participant', params: { userId: 'u2' } },
      {
        type: 'notify',
        params: {
          userIds: ['u3'],
          assignee: false,
          requester: false,
          departmentLeads: false,
          email: false,
          title: 't',
          message: '',
        },
      },
      { type: 'create_task', params: { title: 't', assigneeId: 'u4' } },
      { type: 'create_task', params: { title: 't' } },
      { type: 'apply_template', params: { templateId: 't1' } },
      {
        type: 'escalate',
        params: {
          kind: 'FUNCTIONAL',
          toDepartmentId: 'd3',
          toUserId: 'u5',
          reason: 'r',
        },
      },
      { type: 'escalate', params: { kind: 'HIERARCHICAL', reason: 'r' } },
      { type: 'add_tag', params: { tag: 'x' } },
      { type: 'set_field', params: { field: 'title', value: 'x' } },
      { type: 'post_message', params: { body: 'x', visibility: 'INTERNAL' } },
    ] as SdAutomationAction[]
    expect(sdAutomationActionRefs(actions)).toEqual({
      departmentIds: ['d1', 'd2', 'd3'],
      userIds: ['u1', 'u2', 'u3', 'u4', 'u5'],
      templateIds: ['t1'],
    })
  })
})

describe('custom field schemas', () => {
  const base = { entity: 'TICKET', key: 'serial', label: 'Série', type: 'TEXT' }

  it('applies defaults', () => {
    expect(CreateSdCustomFieldSchema.parse(base)).toEqual({
      ...base,
      options: [],
      ticketTypes: [],
      categoryIds: [],
      required: false,
      visibleInPortal: false,
      active: true,
    })
  })

  it('validates key, options and select requirements', () => {
    expect(
      CreateSdCustomFieldSchema.safeParse({ ...base, key: '1abc' }).success,
    ).toBe(false)
    expect(
      CreateSdCustomFieldSchema.safeParse({ ...base, type: 'SELECT' }).success,
    ).toBe(false)
    expect(
      CreateSdCustomFieldSchema.safeParse({ ...base, type: 'MULTI_SELECT' })
        .success,
    ).toBe(false)
    expect(
      CreateSdCustomFieldSchema.safeParse({
        ...base,
        type: 'SELECT',
        options: [
          { value: 'a', label: 'A' },
          { value: 'a', label: 'B' },
        ],
      }).success,
    ).toBe(false)
    const parsed = CreateSdCustomFieldSchema.parse({
      ...base,
      type: 'SELECT',
      options: [{ value: 'a', label: 'A', color: '#000000' }],
      ticketTypes: ['INCIDENT', 'INCIDENT'],
      categoryIds: ['c', 'c'],
      defaultValue: 'a',
    })
    expect(parsed.ticketTypes).toEqual(['INCIDENT'])
    expect(parsed.categoryIds).toEqual(['c'])
  })

  it('validates update and list', () => {
    expect(UpdateSdCustomFieldSchema.safeParse({}).success).toBe(false)
    expect(UpdateSdCustomFieldSchema.parse({ defaultValue: null })).toEqual({
      defaultValue: null,
    })
    expect(ListSdCustomFieldsSchema.parse({ entity: 'CONTACT' })).toEqual({
      entity: 'CONTACT',
      includeInactive: false,
    })
  })
})
