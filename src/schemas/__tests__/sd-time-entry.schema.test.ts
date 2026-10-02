import { describe, expect, it } from 'vitest'
import {
  CreateSdTimeEntrySchema,
  SdTimerActionSchema,
  UpdateSdTimeEntrySchema,
} from '../sd-time-entry.schema'

describe('SdTimerActionSchema', () => {
  it('aceita as quatro ações', () => {
    for (const action of ['start', 'pause', 'resume', 'stop'] as const) {
      expect(SdTimerActionSchema.parse({ action }).action).toBe(action)
    }
  })

  it('recusa ação desconhecida', () => {
    expect(SdTimerActionSchema.safeParse({ action: 'reset' }).success).toBe(
      false,
    )
  })

  it('aceita descrição opcional', () => {
    expect(
      SdTimerActionSchema.parse({
        action: 'stop',
        description: ' Troca do HD ',
      }).description,
    ).toBe('Troca do HD')
    expect(
      SdTimerActionSchema.parse({ action: 'stop', description: null })
        .description,
    ).toBeNull()
  })
})

describe('CreateSdTimeEntrySchema', () => {
  const base = {
    startedAt: '2026-10-07T13:00:00.000Z',
    endedAt: '2026-10-07T14:00:00.000Z',
  }

  it('converte as datas e marca como faturável por padrão', () => {
    const parsed = CreateSdTimeEntrySchema.parse(base)
    expect(parsed.startedAt).toBeInstanceOf(Date)
    expect(parsed.billable).toBe(true)
    expect(parsed.userId).toBeUndefined()
  })

  it('exige início e fim', () => {
    expect(CreateSdTimeEntrySchema.safeParse({}).success).toBe(false)
  })

  it('recusa fim anterior ou igual ao início', () => {
    const bad = CreateSdTimeEntrySchema.safeParse({
      ...base,
      endedAt: base.startedAt,
    })
    expect(bad.success).toBe(false)
    expect(bad.error?.issues[0].path).toEqual(['endedAt'])
  })

  it('aceita apontar por outro agente', () => {
    expect(
      CreateSdTimeEntrySchema.parse({ ...base, userId: 'u2' }).userId,
    ).toBe('u2')
  })

  it('recusa descrição gigante', () => {
    expect(
      CreateSdTimeEntrySchema.safeParse({
        ...base,
        description: 'x'.repeat(1001),
      }).success,
    ).toBe(false)
  })
})

describe('UpdateSdTimeEntrySchema', () => {
  it('exige ao menos um campo', () => {
    expect(UpdateSdTimeEntrySchema.safeParse({}).success).toBe(false)
  })

  it('aceita só o faturável', () => {
    expect(UpdateSdTimeEntrySchema.parse({ billable: false }).billable).toBe(
      false,
    )
  })

  it('valida a ordem das datas quando as duas vêm', () => {
    expect(
      UpdateSdTimeEntrySchema.safeParse({
        startedAt: '2026-10-07T14:00:00.000Z',
        endedAt: '2026-10-07T13:00:00.000Z',
      }).success,
    ).toBe(false)
    expect(
      UpdateSdTimeEntrySchema.safeParse({ endedAt: '2026-10-07T13:00:00.000Z' })
        .success,
    ).toBe(true)
  })
})
