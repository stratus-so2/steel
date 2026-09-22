import { describe, expect, it } from 'vitest'
import {
  BulkUpdateSdTicketsSchema,
  CreateSdTicketSchema,
  ListSdTicketEventsSchema,
  ListSdTicketsSchema,
  MoveSdTicketPhaseSchema,
  SetSdTicketParentSchema,
  sdTicketListQuery,
  UpdateSdTicketSchema,
} from '../sd-ticket.schema'
import { EscalateSdTicketSchema } from '../sd-ticket-escalation.schema'
import { AddSdTicketParticipantSchema } from '../sd-ticket-participant.schema'

describe('CreateSdTicketSchema', () => {
  it('accepts a minimal ticket and trims the title', () => {
    const parsed = CreateSdTicketSchema.parse({
      type: 'INCIDENT',
      title: '  x  ',
    })
    expect(parsed.title).toBe('x')
  })

  it('rejects missing title, bad type and inverted planned window', () => {
    expect(
      CreateSdTicketSchema.safeParse({ type: 'INCIDENT', title: ' ' }).success,
    ).toBe(false)
    expect(
      CreateSdTicketSchema.safeParse({ type: 'X', title: 'a' }).success,
    ).toBe(false)
    const bad = CreateSdTicketSchema.safeParse({
      type: 'CHANGE',
      title: 'a',
      plannedStartAt: '2026-09-22T10:00:00Z',
      plannedEndAt: '2026-09-22T09:00:00Z',
    })
    expect(bad.success).toBe(false)
    expect(
      CreateSdTicketSchema.safeParse({
        type: 'CHANGE',
        title: 'a',
        plannedStartAt: '2026-09-22T10:00:00Z',
        plannedEndAt: '2026-09-22T11:00:00Z',
        rootCause: '',
      }).success,
    ).toBe(true)
  })
})

describe('UpdateSdTicketSchema', () => {
  it('requires at least one field', () => {
    expect(UpdateSdTicketSchema.safeParse({}).success).toBe(false)
    expect(UpdateSdTicketSchema.parse({ solution: '' }).solution).toBeNull()
  })

  it('validates csat range and planned window', () => {
    expect(UpdateSdTicketSchema.safeParse({ csatScore: 6 }).success).toBe(false)
    expect(
      UpdateSdTicketSchema.safeParse({
        plannedStartAt: '2026-09-22T10:00:00Z',
        plannedEndAt: '2026-09-22T09:00:00Z',
      }).success,
    ).toBe(false)
    expect(
      UpdateSdTicketSchema.safeParse({
        plannedStartAt: '2026-09-22T10:00:00Z',
        plannedEndAt: '2026-09-22T12:00:00Z',
      }).success,
    ).toBe(true)
  })
})

describe('other ticket schemas', () => {
  it('move phase, parent, bulk, participant, escalation, events', () => {
    expect(MoveSdTicketPhaseSchema.safeParse({ phaseId: 'p1' }).success).toBe(
      true,
    )
    expect(MoveSdTicketPhaseSchema.safeParse({}).success).toBe(false)
    expect(
      SetSdTicketParentSchema.parse({ parentId: null }).parentId,
    ).toBeNull()
    expect(BulkUpdateSdTicketsSchema.safeParse({ ids: ['a'] }).success).toBe(
      false,
    )
    expect(
      BulkUpdateSdTicketsSchema.safeParse({ ids: ['a'], assigneeId: null })
        .success,
    ).toBe(true)
    expect(
      BulkUpdateSdTicketsSchema.safeParse({ ids: ['a'], phaseId: 'p' }).success,
    ).toBe(true)
    expect(
      BulkUpdateSdTicketsSchema.safeParse({ ids: ['a'], priorityId: 'p' })
        .success,
    ).toBe(true)
    expect(
      BulkUpdateSdTicketsSchema.safeParse({ ids: ['a'], departmentId: 'd' })
        .success,
    ).toBe(true)
    expect(AddSdTicketParticipantSchema.safeParse({ userId: '' }).success).toBe(
      false,
    )
    expect(
      EscalateSdTicketSchema.safeParse({ kind: 'FUNCTIONAL', reason: 'x' })
        .success,
    ).toBe(false)
    expect(
      EscalateSdTicketSchema.safeParse({
        kind: 'FUNCTIONAL',
        reason: 'x',
        toUserId: 'u',
      }).success,
    ).toBe(true)
    expect(
      EscalateSdTicketSchema.safeParse({ kind: 'HIERARCHICAL', reason: 'x' })
        .success,
    ).toBe(true)
    expect(ListSdTicketEventsSchema.parse({ limit: '', cursor: '' })).toEqual({
      limit: 50,
    })
  })
})

describe('ListSdTicketsSchema', () => {
  it('applies defaults', () => {
    expect(ListSdTicketsSchema.parse({})).toMatchObject({
      view: 'list',
      includeClosed: false,
      sort: 'createdAt',
      order: 'desc',
      page: 1,
      pageSize: 50,
      columnLimit: 50,
    })
  })

  it('parses csv, arrays, booleans, numbers and dates', () => {
    const parsed = ListSdTicketsSchema.parse({
      phaseIds: 'a, b,,',
      types: ['INCIDENT', 'CHANGE,PROBLEM'],
      assigneeIds: ['me', 'unassigned'],
      tags: '',
      includeClosed: '1',
      page: '3',
      createdFrom: '2026-09-01',
      q: '',
      requesterId: null,
      participantId: 'me',
    })
    expect(parsed.participantId).toBe('me')
    expect(parsed.phaseIds).toEqual(['a', 'b'])
    expect(parsed.types).toEqual(['INCIDENT', 'CHANGE', 'PROBLEM'])
    expect(parsed.assigneeIds).toEqual(['me', 'unassigned'])
    expect(parsed.tags).toBeUndefined()
    expect(parsed.includeClosed).toBe(true)
    expect(parsed.page).toBe(3)
    expect(parsed.createdFrom).toBeInstanceOf(Date)
    expect(parsed.q).toBeUndefined()
    expect(parsed.requesterId).toBeUndefined()
    expect(
      ListSdTicketsSchema.parse({ includeClosed: 'false' }).includeClosed,
    ).toBe(false)
    expect(
      ListSdTicketsSchema.parse({ includeClosed: '0' }).includeClosed,
    ).toBe(false)
    expect(
      ListSdTicketsSchema.parse({ includeClosed: true }).includeClosed,
    ).toBe(true)
    expect(
      ListSdTicketsSchema.parse({ phaseIds: ' , ' }).phaseIds,
    ).toBeUndefined()
    expect(
      ListSdTicketsSchema.parse({ phaseIds: null }).phaseIds,
    ).toBeUndefined()
    expect(
      ListSdTicketsSchema.safeParse({ includeClosed: 'talvez' }).success,
    ).toBe(false)
    expect(ListSdTicketsSchema.safeParse({ pageSize: '500' }).success).toBe(
      false,
    )
  })
})

describe('sdTicketListQuery', () => {
  it('collects known keys, repeated keys become arrays', () => {
    const params = new URLSearchParams(
      'phaseIds=a&phaseIds=b&type=INCIDENT&unknown=1&q=x',
    )
    expect(sdTicketListQuery(params)).toEqual({
      phaseIds: ['a', 'b'],
      type: 'INCIDENT',
      q: 'x',
    })
  })
})
