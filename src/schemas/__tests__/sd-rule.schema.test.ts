import { describe, expect, it } from 'vitest'
import {
  SdAutomationActionSchema,
  SdAutomationActionsSchema,
  SdConditionSchema,
  SdConditionsSchema,
  SdEscalationActionsSchema,
} from '@/src/schemas/sd-rule.schema'

describe('SdConditionSchema', () => {
  it('accepts a built-in field with a value', () => {
    expect(
      SdConditionSchema.safeParse({
        field: 'type',
        operator: 'equals',
        value: 'INCIDENT',
      }).success,
    ).toBe(true)
  })

  it('accepts a custom field path', () => {
    expect(
      SdConditionSchema.safeParse({
        field: 'customFields.contrato',
        operator: 'contains',
        value: 'ouro',
      }).success,
    ).toBe(true)
  })

  it.each([
    'customFields.',
    'customFields.1abc',
    'customFields.a-b',
    'unknownField',
  ])('rejects the field %s', (field) => {
    expect(
      SdConditionSchema.safeParse({ field, operator: 'equals', value: 'x' })
        .success,
    ).toBe(false)
  })

  it('allows is_empty / is_not_empty without a value', () => {
    expect(
      SdConditionSchema.safeParse({ field: 'assigneeId', operator: 'is_empty' })
        .success,
    ).toBe(true)
    expect(
      SdConditionSchema.safeParse({
        field: 'assigneeId',
        operator: 'is_not_empty',
      }).success,
    ).toBe(true)
  })

  it('requires a value for the other operators', () => {
    const r = SdConditionSchema.safeParse({ field: 'title', operator: 'gt' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.path).toEqual(['value'])
  })

  it('requires a list for in / not_in', () => {
    expect(
      SdConditionSchema.safeParse({
        field: 'priorityId',
        operator: 'in',
        value: 'p1',
      }).success,
    ).toBe(false)
    expect(
      SdConditionSchema.safeParse({
        field: 'priorityId',
        operator: 'not_in',
        value: ['p1', 'p2'],
      }).success,
    ).toBe(true)
  })

  it('caps the number of conditions', () => {
    const many = Array.from({ length: 51 }, () => ({
      field: 'type',
      operator: 'equals',
      value: 'INCIDENT',
    }))
    expect(SdConditionsSchema.safeParse(many).success).toBe(false)
    expect(SdConditionsSchema.safeParse([]).success).toBe(true)
  })
})

describe('SdAutomationActionSchema', () => {
  it.each([
    { type: 'set_field', params: { field: 'priorityId', value: 'p1' } },
    { type: 'assign_department', params: { departmentId: 'd1' } },
    { type: 'assign_user', params: { userId: 'u1' } },
    { type: 'round_robin', params: {} },
    { type: 'add_participant', params: { userId: 'u1' } },
    { type: 'add_tag', params: { tag: 'vip' } },
    { type: 'notify', params: { title: 'Atenção' } },
    { type: 'post_message', params: { body: 'Recebemos seu chamado' } },
    {
      type: 'create_task',
      params: { title: 'Checar backup', dueInMinutes: 60 },
    },
    { type: 'apply_template', params: { templateId: 't1' } },
    {
      type: 'escalate',
      params: { kind: 'HIERARCHICAL', reason: 'Cliente VIP' },
    },
  ])('accepts $type', (action) => {
    expect(SdAutomationActionSchema.safeParse(action).success).toBe(true)
  })

  it('fills defaults for notify and post_message', () => {
    const notify = SdAutomationActionSchema.parse({
      type: 'notify',
      params: { title: 'x' },
    })
    expect(notify.params).toMatchObject({
      userIds: [],
      assignee: false,
      requester: false,
      departmentLeads: false,
      email: false,
      message: '',
    })
    const post = SdAutomationActionSchema.parse({
      type: 'post_message',
      params: { body: 'oi' },
    })
    expect(post.params).toMatchObject({ visibility: 'INTERNAL' })
  })

  it('rejects an unknown action type', () => {
    expect(
      SdAutomationActionSchema.safeParse({ type: 'delete_all', params: {} })
        .success,
    ).toBe(false)
  })

  it('requires at least one action in a rule', () => {
    expect(SdAutomationActionsSchema.safeParse([]).success).toBe(false)
  })
})

describe('SdEscalationActionsSchema', () => {
  it('defaults to a hierarchical escalation notifying leads', () => {
    expect(SdEscalationActionsSchema.parse({})).toEqual({
      kind: 'HIERARCHICAL',
      notifyUserIds: [],
      notifyAssignee: true,
      notifyDepartmentLeads: true,
      reassignDepartmentId: null,
      reassignUserId: null,
      raisePriority: false,
      email: false,
    })
  })

  it('requires a target for a functional escalation', () => {
    expect(
      SdEscalationActionsSchema.safeParse({ kind: 'FUNCTIONAL' }).success,
    ).toBe(false)
    expect(
      SdEscalationActionsSchema.safeParse({
        kind: 'FUNCTIONAL',
        reassignUserId: 'u1',
      }).success,
    ).toBe(true)
    expect(
      SdEscalationActionsSchema.safeParse({
        kind: 'FUNCTIONAL',
        reassignDepartmentId: 'd1',
      }).success,
    ).toBe(true)
  })
})
