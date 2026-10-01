import { describe, expect, it } from 'vitest'
import {
  expandSdChangeWindow,
  expandSdChangeWindows,
  sdMonthGridRange,
  sdOccurrencesCovering,
  sdPeriodContains,
  sdPeriodsOverlap,
  sdWeekRange,
  sdWindowApplies,
} from '@/src/lib/servicedesk/change-calendar'
import type { SdChangeRecurrenceInput } from '@/src/schemas/sd-change-window.schema'

const at = (iso: string) => new Date(iso)

/** Janela de 2 h num sábado (2026-01-03 é sábado). */
function window(
  overrides: {
    id?: string
    startsAt?: string
    endsAt?: string
    recurrence?: Partial<SdChangeRecurrenceInput> | null
  } = {},
) {
  const recurrence = overrides.recurrence
  return {
    id: overrides.id ?? 'win_1',
    startsAt: at(overrides.startsAt ?? '2026-01-03T02:00:00.000Z'),
    endsAt: at(overrides.endsAt ?? '2026-01-03T04:00:00.000Z'),
    recurrence:
      recurrence === null || recurrence === undefined
        ? null
        : {
            freq: 'WEEKLY' as const,
            interval: 1,
            byDay: [],
            until: null,
            count: null,
            ...recurrence,
          },
  }
}

const range = (from: string, to: string) => ({ from: at(from), to: at(to) })

const starts = (list: { startsAt: Date }[]) =>
  list.map((o) => o.startsAt.toISOString())

describe('sdPeriodsOverlap', () => {
  it('detects a real intersection', () => {
    expect(
      sdPeriodsOverlap(
        at('2026-01-01T00:00:00.000Z'),
        at('2026-01-01T06:00:00.000Z'),
        at('2026-01-01T05:00:00.000Z'),
        at('2026-01-01T09:00:00.000Z'),
      ),
    ).toBe(true)
  })

  it('treats touching borders as not overlapping', () => {
    expect(
      sdPeriodsOverlap(
        at('2026-01-01T00:00:00.000Z'),
        at('2026-01-01T06:00:00.000Z'),
        at('2026-01-01T06:00:00.000Z'),
        at('2026-01-01T09:00:00.000Z'),
      ),
    ).toBe(false)
  })

  it('is false for disjoint periods', () => {
    expect(
      sdPeriodsOverlap(
        at('2026-01-05T00:00:00.000Z'),
        at('2026-01-05T06:00:00.000Z'),
        at('2026-01-01T00:00:00.000Z'),
        at('2026-01-01T09:00:00.000Z'),
      ),
    ).toBe(false)
  })
})

describe('sdPeriodContains', () => {
  it('accepts a period fully inside, borders included', () => {
    expect(
      sdPeriodContains(
        at('2026-01-01T00:00:00.000Z'),
        at('2026-01-01T06:00:00.000Z'),
        at('2026-01-01T00:00:00.000Z'),
        at('2026-01-01T06:00:00.000Z'),
      ),
    ).toBe(true)
  })

  it('rejects a period that leaks out', () => {
    expect(
      sdPeriodContains(
        at('2026-01-01T00:00:00.000Z'),
        at('2026-01-01T06:00:00.000Z'),
        at('2026-01-01T05:00:00.000Z'),
        at('2026-01-01T07:00:00.000Z'),
      ),
    ).toBe(false)
  })
})

describe('expandSdChangeWindow · sem recorrência', () => {
  it('devolve a própria janela quando cruza o intervalo', () => {
    const result = expandSdChangeWindow(
      window({ recurrence: null }),
      range('2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z'),
    )
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      windowId: 'win_1',
      recurring: false,
    })
    expect(result[0].startsAt.toISOString()).toBe('2026-01-03T02:00:00.000Z')
    expect(result[0].endsAt.toISOString()).toBe('2026-01-03T04:00:00.000Z')
  })

  it('devolve vazio fora do intervalo', () => {
    expect(
      expandSdChangeWindow(
        window({ recurrence: null }),
        range('2026-02-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z'),
      ),
    ).toEqual([])
  })

  it('inclui a janela que começa antes e termina dentro do intervalo', () => {
    const result = expandSdChangeWindow(
      window({
        recurrence: null,
        startsAt: '2026-01-01T22:00:00.000Z',
        endsAt: '2026-01-02T04:00:00.000Z',
      }),
      range('2026-01-02T00:00:00.000Z', '2026-01-03T00:00:00.000Z'),
    )
    expect(result).toHaveLength(1)
  })

  it('exclui a janela de duração zero (não cruza nada)', () => {
    expect(
      expandSdChangeWindow(
        window({
          recurrence: null,
          startsAt: '2026-01-03T02:00:00.000Z',
          endsAt: '2026-01-03T02:00:00.000Z',
        }),
        range('2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z'),
      ),
    ).toEqual([])
  })

  it('trata fim antes do início como duração zero', () => {
    expect(
      expandSdChangeWindow(
        window({
          recurrence: null,
          startsAt: '2026-01-03T04:00:00.000Z',
          endsAt: '2026-01-03T02:00:00.000Z',
        }),
        range('2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z'),
      ),
    ).toEqual([])
  })
})

describe('expandSdChangeWindow · DAILY', () => {
  it('repete todo dia mantendo a duração', () => {
    const result = expandSdChangeWindow(
      window({ recurrence: { freq: 'DAILY' } }),
      range('2026-01-03T00:00:00.000Z', '2026-01-07T00:00:00.000Z'),
    )
    expect(starts(result)).toEqual([
      '2026-01-03T02:00:00.000Z',
      '2026-01-04T02:00:00.000Z',
      '2026-01-05T02:00:00.000Z',
      '2026-01-06T02:00:00.000Z',
    ])
    expect(result[0].recurring).toBe(false)
    expect(result[1].recurring).toBe(true)
    for (const occurrence of result) {
      expect(occurrence.endsAt.getTime() - occurrence.startsAt.getTime()).toBe(
        2 * 60 * 60 * 1000,
      )
    }
  })

  it('respeita o intervalo de 3 dias', () => {
    const result = expandSdChangeWindow(
      window({ recurrence: { freq: 'DAILY', interval: 3 } }),
      range('2026-01-03T00:00:00.000Z', '2026-01-13T00:00:00.000Z'),
    )
    expect(starts(result)).toEqual([
      '2026-01-03T02:00:00.000Z',
      '2026-01-06T02:00:00.000Z',
      '2026-01-09T02:00:00.000Z',
      '2026-01-12T02:00:00.000Z',
    ])
  })

  it('corta a série em `count`', () => {
    const result = expandSdChangeWindow(
      window({ recurrence: { freq: 'DAILY', count: 2 } }),
      range('2026-01-03T00:00:00.000Z', '2026-02-01T00:00:00.000Z'),
    )
    expect(starts(result)).toEqual([
      '2026-01-03T02:00:00.000Z',
      '2026-01-04T02:00:00.000Z',
    ])
  })

  it('corta a série em `until` (dia inclusivo)', () => {
    const result = expandSdChangeWindow(
      window({ recurrence: { freq: 'DAILY', until: '2026-01-05' } }),
      range('2026-01-03T00:00:00.000Z', '2026-02-01T00:00:00.000Z'),
    )
    expect(starts(result)).toEqual([
      '2026-01-03T02:00:00.000Z',
      '2026-01-04T02:00:00.000Z',
      '2026-01-05T02:00:00.000Z',
    ])
  })

  it('ignora um `until` que não é data', () => {
    const result = expandSdChangeWindow(
      window({ recurrence: { freq: 'DAILY', until: 'nope', count: 2 } }),
      range('2026-01-03T00:00:00.000Z', '2026-02-01T00:00:00.000Z'),
    )
    expect(result).toHaveLength(2)
  })

  it('só devolve as ocorrências dentro do intervalo pedido', () => {
    const result = expandSdChangeWindow(
      window({ recurrence: { freq: 'DAILY' } }),
      range('2026-01-10T00:00:00.000Z', '2026-01-12T00:00:00.000Z'),
    )
    expect(starts(result)).toEqual([
      '2026-01-10T02:00:00.000Z',
      '2026-01-11T02:00:00.000Z',
    ])
    expect(result.every((o) => o.recurring)).toBe(true)
  })

  it('alcança um intervalo anos depois do início (série aberta)', () => {
    const result = expandSdChangeWindow(
      window({ recurrence: { freq: 'DAILY' } }),
      range('2030-06-10T00:00:00.000Z', '2030-06-13T00:00:00.000Z'),
    )
    expect(starts(result)).toEqual([
      '2030-06-10T02:00:00.000Z',
      '2030-06-11T02:00:00.000Z',
      '2030-06-12T02:00:00.000Z',
    ])
  })

  it('não estoura o teto de ocorrências num intervalo gigante', () => {
    const result = expandSdChangeWindow(
      window({ recurrence: { freq: 'DAILY' } }),
      range('2026-01-03T00:00:00.000Z', '2030-01-01T00:00:00.000Z'),
    )
    expect(result).toHaveLength(365)
  })
})

describe('expandSdChangeWindow · WEEKLY', () => {
  it('repete no mesmo dia da semana sem `byDay`', () => {
    const result = expandSdChangeWindow(
      window({ recurrence: { freq: 'WEEKLY' } }),
      range('2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z'),
    )
    expect(starts(result)).toEqual([
      '2026-01-03T02:00:00.000Z',
      '2026-01-10T02:00:00.000Z',
      '2026-01-17T02:00:00.000Z',
      '2026-01-24T02:00:00.000Z',
      '2026-01-31T02:00:00.000Z',
    ])
  })

  it('pula semanas com `interval` 2', () => {
    const result = expandSdChangeWindow(
      window({ recurrence: { freq: 'WEEKLY', interval: 2 } }),
      range('2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z'),
    )
    expect(starts(result)).toEqual([
      '2026-01-03T02:00:00.000Z',
      '2026-01-17T02:00:00.000Z',
      '2026-01-31T02:00:00.000Z',
    ])
  })

  it('alcança um intervalo anos depois do início (série aberta)', () => {
    const result = expandSdChangeWindow(
      window({ recurrence: { freq: 'WEEKLY' } }),
      range('2030-01-01T00:00:00.000Z', '2030-01-15T00:00:00.000Z'),
    )
    // 2026-01-03 é sábado; os sábados de janeiro/2030 são 05 e 12.
    expect(starts(result)).toEqual([
      '2030-01-05T02:00:00.000Z',
      '2030-01-12T02:00:00.000Z',
    ])
  })

  it('expande `byDay` em ordem de semana (sáb e dom)', () => {
    const result = expandSdChangeWindow(
      window({ recurrence: { freq: 'WEEKLY', byDay: ['sun', 'sat'] } }),
      range('2026-01-01T00:00:00.000Z', '2026-01-19T00:00:00.000Z'),
    )
    expect(starts(result)).toEqual([
      '2026-01-03T02:00:00.000Z',
      '2026-01-04T02:00:00.000Z',
      '2026-01-10T02:00:00.000Z',
      '2026-01-11T02:00:00.000Z',
      '2026-01-17T02:00:00.000Z',
      '2026-01-18T02:00:00.000Z',
    ])
  })

  it('não gera ocorrência antes do início da janela na primeira semana', () => {
    // Janela num sábado com `byDay` incluindo a quarta: a quarta da semana 0
    // é anterior ao início e fica fora da série.
    const result = expandSdChangeWindow(
      window({ recurrence: { freq: 'WEEKLY', byDay: ['wed', 'sat'] } }),
      range('2026-01-01T00:00:00.000Z', '2026-01-15T00:00:00.000Z'),
    )
    expect(starts(result)).toEqual([
      '2026-01-03T02:00:00.000Z',
      '2026-01-07T02:00:00.000Z',
      '2026-01-10T02:00:00.000Z',
      '2026-01-14T02:00:00.000Z',
    ])
  })

  it('conta `count` sem gastar os dias descartados da primeira semana', () => {
    const result = expandSdChangeWindow(
      window({
        recurrence: { freq: 'WEEKLY', byDay: ['wed', 'sat'], count: 3 },
      }),
      range('2026-01-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z'),
    )
    expect(starts(result)).toEqual([
      '2026-01-03T02:00:00.000Z',
      '2026-01-07T02:00:00.000Z',
      '2026-01-10T02:00:00.000Z',
    ])
  })

  it('ignora um dia desconhecido em `byDay`', () => {
    const result = expandSdChangeWindow(
      {
        ...window(),
        recurrence: {
          freq: 'WEEKLY',
          interval: 1,
          byDay: ['sat', 'xxx'],
          until: null,
          count: 2,
        } as unknown as SdChangeRecurrenceInput,
      },
      range('2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z'),
    )
    expect(starts(result)).toEqual([
      '2026-01-03T02:00:00.000Z',
      '2026-01-10T02:00:00.000Z',
    ])
  })
})

describe('expandSdChangeWindow · MONTHLY', () => {
  it('repete no mesmo dia do mês', () => {
    const result = expandSdChangeWindow(
      window({
        startsAt: '2026-01-15T02:00:00.000Z',
        endsAt: '2026-01-15T06:00:00.000Z',
        recurrence: { freq: 'MONTHLY' },
      }),
      range('2026-01-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z'),
    )
    expect(starts(result)).toEqual([
      '2026-01-15T02:00:00.000Z',
      '2026-02-15T02:00:00.000Z',
      '2026-03-15T02:00:00.000Z',
    ])
  })

  it('gruda no último dia quando o mês é mais curto', () => {
    const result = expandSdChangeWindow(
      window({
        startsAt: '2026-01-31T02:00:00.000Z',
        endsAt: '2026-01-31T06:00:00.000Z',
        recurrence: { freq: 'MONTHLY', count: 3 },
      }),
      range('2026-01-01T00:00:00.000Z', '2026-05-01T00:00:00.000Z'),
    )
    expect(starts(result)).toEqual([
      '2026-01-31T02:00:00.000Z',
      '2026-02-28T02:00:00.000Z',
      '2026-03-31T02:00:00.000Z',
    ])
  })

  it('respeita o intervalo trimestral', () => {
    const result = expandSdChangeWindow(
      window({
        startsAt: '2026-01-10T02:00:00.000Z',
        endsAt: '2026-01-10T06:00:00.000Z',
        recurrence: { freq: 'MONTHLY', interval: 3 },
      }),
      range('2026-01-01T00:00:00.000Z', '2026-12-01T00:00:00.000Z'),
    )
    expect(starts(result)).toEqual([
      '2026-01-10T02:00:00.000Z',
      '2026-04-10T02:00:00.000Z',
      '2026-07-10T02:00:00.000Z',
      '2026-10-10T02:00:00.000Z',
    ])
  })

  it('alcança um intervalo anos depois do início', () => {
    const result = expandSdChangeWindow(
      window({
        startsAt: '2020-03-10T02:00:00.000Z',
        endsAt: '2020-03-10T06:00:00.000Z',
        recurrence: { freq: 'MONTHLY' },
      }),
      range('2026-10-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z'),
    )
    expect(starts(result)).toEqual(['2026-10-10T02:00:00.000Z'])
  })
})

describe('expandSdChangeWindows', () => {
  it('junta as janelas em ordem de início', () => {
    const result = expandSdChangeWindows(
      [
        window({
          id: 'b',
          startsAt: '2026-01-05T02:00:00.000Z',
          endsAt: '2026-01-05T04:00:00.000Z',
        }),
        window({ id: 'a', recurrence: { freq: 'DAILY', count: 2 } }),
      ],
      range('2026-01-01T00:00:00.000Z', '2026-01-08T00:00:00.000Z'),
    )
    expect(result.map((o) => [o.windowId, o.startsAt.toISOString()])).toEqual([
      ['a', '2026-01-03T02:00:00.000Z'],
      ['a', '2026-01-04T02:00:00.000Z'],
      ['b', '2026-01-05T02:00:00.000Z'],
    ])
  })

  it('devolve vazio sem janelas', () => {
    expect(
      expandSdChangeWindows(
        [],
        range('2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z'),
      ),
    ).toEqual([])
  })
})

describe('sdWindowApplies', () => {
  const target = { configItemId: 'ci_1', departmentId: 'dep_1' }

  it('vale para toda a workspace quando as listas estão vazias', () => {
    expect(
      sdWindowApplies({ configItemIds: [], departmentIds: [] }, target),
    ).toBe(true)
  })

  it('casa pelo item de configuração', () => {
    expect(
      sdWindowApplies({ configItemIds: ['ci_1'], departmentIds: [] }, target),
    ).toBe(true)
    expect(
      sdWindowApplies({ configItemIds: ['ci_2'], departmentIds: [] }, target),
    ).toBe(false)
  })

  it('casa pelo departamento', () => {
    expect(
      sdWindowApplies({ configItemIds: [], departmentIds: ['dep_1'] }, target),
    ).toBe(true)
    expect(
      sdWindowApplies({ configItemIds: [], departmentIds: ['dep_9'] }, target),
    ).toBe(false)
  })

  it('exige os dois quando a janela restringe os dois', () => {
    expect(
      sdWindowApplies(
        { configItemIds: ['ci_1'], departmentIds: ['dep_9'] },
        target,
      ),
    ).toBe(false)
  })

  it('não casa um alvo sem item quando a janela restringe por item', () => {
    expect(
      sdWindowApplies(
        { configItemIds: ['ci_1'], departmentIds: [] },
        { configItemId: null, departmentId: 'dep_1' },
      ),
    ).toBe(false)
  })

  it('não casa um alvo sem departamento quando a janela o restringe', () => {
    expect(
      sdWindowApplies(
        { configItemIds: [], departmentIds: ['dep_1'] },
        { configItemId: 'ci_1', departmentId: null },
      ),
    ).toBe(false)
  })
})

describe('sdOccurrencesCovering', () => {
  const occurrences = expandSdChangeWindow(
    window({ recurrence: { freq: 'DAILY' } }),
    range('2026-01-03T00:00:00.000Z', '2026-01-10T00:00:00.000Z'),
  )

  it('devolve só as ocorrências que cruzam o período', () => {
    const covering = sdOccurrencesCovering(occurrences, {
      startsAt: at('2026-01-05T03:00:00.000Z'),
      endsAt: at('2026-01-05T05:00:00.000Z'),
    })
    expect(starts(covering)).toEqual(['2026-01-05T02:00:00.000Z'])
  })

  it('devolve vazio quando nada cruza', () => {
    expect(
      sdOccurrencesCovering(occurrences, {
        startsAt: at('2026-01-05T10:00:00.000Z'),
        endsAt: at('2026-01-05T12:00:00.000Z'),
      }),
    ).toEqual([])
  })
})

describe('sdMonthGridRange', () => {
  it('cobre o mês com semanas completas (dom–sáb)', () => {
    const grid = sdMonthGridRange(at('2026-01-15T12:00:00.000Z'))
    // 2026-01-01 é quinta → a grade começa no domingo 2025-12-28.
    expect(grid.from.toISOString()).toBe('2025-12-28T00:00:00.000Z')
    expect(grid.to.toISOString()).toBe('2026-02-01T00:00:00.000Z')
  })

  it('não acrescenta semana quando o mês já fecha no sábado', () => {
    // Fevereiro de 2026 vai de domingo 01 a sábado 28.
    const grid = sdMonthGridRange(at('2026-02-10T12:00:00.000Z'))
    expect(grid.from.toISOString()).toBe('2026-02-01T00:00:00.000Z')
    expect(grid.to.toISOString()).toBe('2026-03-01T00:00:00.000Z')
  })
})

describe('sdWeekRange', () => {
  it('vai do domingo ao domingo seguinte', () => {
    const week = sdWeekRange(at('2026-01-07T18:30:00.000Z'))
    expect(week.from.toISOString()).toBe('2026-01-04T00:00:00.000Z')
    expect(week.to.toISOString()).toBe('2026-01-11T00:00:00.000Z')
  })

  it('mantém o domingo quando a data já é domingo', () => {
    const week = sdWeekRange(at('2026-01-04T00:00:00.000Z'))
    expect(week.from.toISOString()).toBe('2026-01-04T00:00:00.000Z')
  })
})
