import { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import {
  computeSdPeriodTotals,
  pickSdContractRate,
  resolveSdEntryRate,
  resolveSdRateWindow,
  roundSdMinutes,
  type SdBillingRate,
  sdBillableMinutes,
  sdContractCovers,
  sdElapsedMinutes,
  sdEntryAmount,
  sdLocalDayRange,
  sdLocalDayStart,
  sdPeriodRange,
} from '@/src/lib/servicedesk/billing'
import { parseSdCalendar, type SdCalendar } from '@/src/lib/servicedesk/sla'

const WEEK_8x5 = {
  mon: [['08:00', '18:00']],
  tue: [['08:00', '18:00']],
  wed: [['08:00', '18:00']],
  thu: [['08:00', '18:00']],
  fri: [['08:00', '18:00']],
  sat: [],
  sun: [],
}

function calendar(overrides?: {
  schedule?: unknown
  holidays?: unknown
  is24x7?: boolean
  timezone?: string
}): SdCalendar {
  return parseSdCalendar({
    timezone: overrides?.timezone ?? 'America/Sao_Paulo',
    schedule: overrides?.schedule ?? WEEK_8x5,
    holidays: overrides?.holidays ?? [{ date: '2026-12-25', name: 'Natal' }],
    is24x7: overrides?.is24x7 ?? false,
  })
}

/* --------------------------- janela do apontamento --------------------------- */

describe('resolveSdRateWindow', () => {
  const cal = calendar()

  it('devolve BUSINESS_HOURS dentro do expediente', () => {
    // Quarta, 2026-10-07, 10:00 em São Paulo (UTC-3).
    expect(resolveSdRateWindow(new Date('2026-10-07T13:00:00Z'), cal)).toBe(
      'BUSINESS_HOURS',
    )
  })

  it('devolve AFTER_HOURS fora do expediente num dia útil', () => {
    expect(resolveSdRateWindow(new Date('2026-10-07T01:00:00Z'), cal)).toBe(
      'AFTER_HOURS',
    )
    // 18:00 local é o fim da janela (exclusivo).
    expect(resolveSdRateWindow(new Date('2026-10-07T21:00:00Z'), cal)).toBe(
      'AFTER_HOURS',
    )
  })

  it('devolve WEEKEND no sábado e no domingo sem expediente', () => {
    expect(resolveSdRateWindow(new Date('2026-10-10T13:00:00Z'), cal)).toBe(
      'WEEKEND',
    )
    expect(resolveSdRateWindow(new Date('2026-10-11T13:00:00Z'), cal)).toBe(
      'WEEKEND',
    )
  })

  it('devolve BUSINESS_HOURS no sábado quando há plantão agendado', () => {
    const saturday = calendar({
      schedule: { ...WEEK_8x5, sat: [['09:00', '13:00']] },
    })
    expect(
      resolveSdRateWindow(new Date('2026-10-10T13:00:00Z'), saturday),
    ).toBe('BUSINESS_HOURS')
    expect(
      resolveSdRateWindow(new Date('2026-10-10T18:00:00Z'), saturday),
    ).toBe('WEEKEND')
  })

  it('feriado vence o expediente', () => {
    // 2026-12-25 é uma sexta dentro do expediente, mas é feriado.
    expect(resolveSdRateWindow(new Date('2026-12-25T13:00:00Z'), cal)).toBe(
      'HOLIDAY',
    )
  })

  it('trata a janela que cruza a meia-noite como expediente nos dois dias', () => {
    const night = calendar({
      schedule: { ...WEEK_8x5, wed: [['22:00', '02:00']] },
    })
    // Quarta 23:00 local.
    expect(resolveSdRateWindow(new Date('2026-10-08T02:00:00Z'), night)).toBe(
      'BUSINESS_HOURS',
    )
    // Quinta 01:00 local (rabo da janela da quarta).
    expect(resolveSdRateWindow(new Date('2026-10-08T04:00:00Z'), night)).toBe(
      'BUSINESS_HOURS',
    )
    // Quinta 03:00 local: já passou.
    expect(resolveSdRateWindow(new Date('2026-10-08T06:00:00Z'), night)).toBe(
      'AFTER_HOURS',
    )
  })

  it('ignora janelas degeneradas e malformadas', () => {
    const odd = calendar({
      schedule: { ...WEEK_8x5, wed: [['10:00', '10:00']] },
    })
    expect(resolveSdRateWindow(new Date('2026-10-07T13:00:00Z'), odd)).toBe(
      'AFTER_HOURS',
    )
  })

  it('dia sem nenhuma janela cadastrada cai fora de hora', () => {
    const onlyWed = calendar({ schedule: { wed: [['08:00', '18:00']] } })
    // Segunda 10:00 local: nem o dia nem o anterior têm expediente.
    expect(resolveSdRateWindow(new Date('2026-10-05T13:00:00Z'), onlyWed)).toBe(
      'AFTER_HOURS',
    )
  })

  it('relógio corrido (24×7 ou sem expediente) é sempre BUSINESS_HOURS', () => {
    const always = calendar({ is24x7: true })
    expect(resolveSdRateWindow(new Date('2026-10-11T03:00:00Z'), always)).toBe(
      'BUSINESS_HOURS',
    )
    const empty = calendar({ schedule: {}, holidays: [] })
    expect(resolveSdRateWindow(new Date('2026-10-11T03:00:00Z'), empty)).toBe(
      'BUSINESS_HOURS',
    )
  })
})

/* ------------------------------ minutos cobrados ----------------------------- */

describe('sdElapsedMinutes', () => {
  it('arredonda para cima, com piso de 1 minuto', () => {
    expect(
      sdElapsedMinutes(
        new Date('2026-10-07T10:00:00Z'),
        new Date('2026-10-07T10:00:10Z'),
      ),
    ).toBe(1)
    expect(
      sdElapsedMinutes(
        new Date('2026-10-07T10:00:00Z'),
        new Date('2026-10-07T10:12:30Z'),
      ),
    ).toBe(13)
  })

  it('devolve 0 quando o fim não é depois do início', () => {
    const at = new Date('2026-10-07T10:00:00Z')
    expect(sdElapsedMinutes(at, at)).toBe(0)
    expect(sdElapsedMinutes(at, new Date('2026-10-07T09:00:00Z'))).toBe(0)
  })
})

describe('roundSdMinutes', () => {
  it('arredonda para cima no múltiplo do passo', () => {
    expect(roundSdMinutes(1, 15)).toBe(15)
    expect(roundSdMinutes(15, 15)).toBe(15)
    expect(roundSdMinutes(16, 15)).toBe(30)
    expect(roundSdMinutes(31, 30)).toBe(60)
  })

  it('passo 1 ou inválido não arredonda', () => {
    expect(roundSdMinutes(17, 1)).toBe(17)
    expect(roundSdMinutes(17, 0)).toBe(17)
    expect(roundSdMinutes(17.2, Number.NaN)).toBe(18)
  })

  it('zero e negativo viram 0', () => {
    expect(roundSdMinutes(0, 15)).toBe(0)
    expect(roundSdMinutes(-5, 15)).toBe(0)
  })
})

describe('sdBillableMinutes', () => {
  const contract = { roundingMinutes: 15, minimumMinutes: 30 }

  it('aplica o mínimo no primeiro apontamento do dia', () => {
    expect(sdBillableMinutes(5, contract, true)).toBe(30)
  })

  it('não aplica o mínimo nos apontamentos seguintes', () => {
    expect(sdBillableMinutes(5, contract, false)).toBe(15)
  })

  it('mantém o arredondado quando ele já passa do mínimo', () => {
    expect(sdBillableMinutes(40, contract, true)).toBe(45)
  })

  it('devolve 0 sem tempo apontado', () => {
    expect(sdBillableMinutes(0, contract, true)).toBe(0)
  })
})

/* ------------------------------ regra de valor ------------------------------- */

function rate(overrides?: Partial<SdBillingRate>): SdBillingRate {
  return {
    id: 'r1',
    ticketType: null,
    priorityId: null,
    window: 'BUSINESS_HOURS',
    hourlyRate: '100.00',
    multiplier: '1.00',
    position: 0,
    ...overrides,
  }
}

describe('pickSdContractRate', () => {
  const facts = {
    ticketType: 'INCIDENT' as const,
    priorityId: 'p1',
    window: 'AFTER_HOURS' as const,
  }

  it('escolhe a primeira regra que casa, pela posição', () => {
    const picked = pickSdContractRate(
      [
        rate({ id: 'late', window: 'AFTER_HOURS', position: 5 }),
        rate({ id: 'early', window: 'AFTER_HOURS', position: 1 }),
      ],
      facts,
    )
    expect(picked?.id).toBe('early')
  })

  it('casa curinga de tipo e de prioridade', () => {
    const picked = pickSdContractRate(
      [rate({ id: 'wild', window: 'AFTER_HOURS' })],
      facts,
    )
    expect(picked?.id).toBe('wild')
  })

  it('respeita tipo e prioridade específicos', () => {
    expect(
      pickSdContractRate(
        [rate({ window: 'AFTER_HOURS', ticketType: 'CHANGE' })],
        facts,
      ),
    ).toBeNull()
    expect(
      pickSdContractRate(
        [rate({ window: 'AFTER_HOURS', priorityId: 'outra' })],
        facts,
      ),
    ).toBeNull()
  })

  it('não casa janela diferente', () => {
    expect(pickSdContractRate([rate({ window: 'HOLIDAY' })], facts)).toBeNull()
  })

  it('devolve null sem regras', () => {
    expect(pickSdContractRate([], facts)).toBeNull()
  })
})

describe('resolveSdEntryRate', () => {
  const facts = {
    ticketType: 'INCIDENT' as const,
    priorityId: 'p1',
    window: 'BUSINESS_HOURS' as const,
  }

  it('usa a regra que casou, inclusive no excedente', () => {
    const resolved = resolveSdEntryRate(
      { hourlyRate: '100.00', overtimeRate: '200.00' },
      [rate({ id: 'r9', hourlyRate: '180.00', multiplier: '1.50' })],
      facts,
    )
    expect(resolved.rateId).toBe('r9')
    expect(resolved.hourlyRate.toFixed(2)).toBe('180.00')
    expect(resolved.overtimeRate.toFixed(2)).toBe('180.00')
    expect(resolved.multiplier.toFixed(2)).toBe('1.50')
  })

  it('sem regra usa o contrato e a hora de excedente', () => {
    const resolved = resolveSdEntryRate(
      { hourlyRate: '100.00', overtimeRate: '150.00' },
      [],
      facts,
    )
    expect(resolved.rateId).toBeNull()
    expect(resolved.hourlyRate.toFixed(2)).toBe('100.00')
    expect(resolved.overtimeRate.toFixed(2)).toBe('150.00')
    expect(resolved.multiplier.toFixed(2)).toBe('1.00')
  })

  it('regra sem id devolve rateId nulo', () => {
    const { id: _id, ...anonymous } = rate({ hourlyRate: '90.00' })
    const resolved = resolveSdEntryRate(
      { hourlyRate: '100.00', overtimeRate: null },
      [anonymous],
      facts,
    )
    expect(resolved.rateId).toBeNull()
    expect(resolved.hourlyRate.toFixed(2)).toBe('90.00')
  })

  it('sem hora de excedente cobra a hora normal', () => {
    const resolved = resolveSdEntryRate(
      { hourlyRate: '100.00', overtimeRate: null },
      [],
      facts,
    )
    expect(resolved.overtimeRate.toFixed(2)).toBe('100.00')
  })
})

describe('sdEntryAmount', () => {
  it('minutos × hora × multiplicador, em centavos', () => {
    const amount = sdEntryAmount(90, {
      hourlyRate: new Prisma.Decimal('120.00'),
      multiplier: new Prisma.Decimal('1.50'),
    })
    expect(amount.toFixed(2)).toBe('270.00')
  })

  it('arredonda meio centavo para cima', () => {
    const amount = sdEntryAmount(1, {
      hourlyRate: new Prisma.Decimal('100.00'),
      multiplier: new Prisma.Decimal('1.00'),
    })
    expect(amount.toFixed(2)).toBe('1.67')
  })

  it('zero minutos vale zero', () => {
    expect(
      sdEntryAmount(0, {
        hourlyRate: new Prisma.Decimal('100'),
        multiplier: new Prisma.Decimal('1'),
      }).toFixed(2),
    ).toBe('0.00')
  })
})

/* --------------------------------- período ---------------------------------- */

describe('computeSdPeriodTotals', () => {
  const entry = (
    minutes: number,
    billable = true,
    overtimeRate = '100.00',
    multiplier = '1.00',
  ) => ({ minutes, billable, overtimeRate, multiplier })

  it('consome a franquia na ordem e cobra só o excedente', () => {
    const totals = computeSdPeriodTotals(
      [entry(60), entry(90), entry(30)],
      { carryOver: false },
      120,
    )
    expect(totals.usedMinutes).toBe(180)
    expect(totals.billableMinutes).toBe(180)
    expect(totals.coveredMinutes).toBe(120)
    expect(totals.overageMinutes).toBe(60)
    expect(totals.carriedMinutes).toBe(0)
    expect(totals.amount.toFixed(2)).toBe('100.00')
  })

  it('não cobra apontamento marcado como não faturável', () => {
    const totals = computeSdPeriodTotals(
      [entry(60, false), entry(60)],
      { carryOver: false },
      0,
    )
    expect(totals.usedMinutes).toBe(120)
    expect(totals.billableMinutes).toBe(60)
    expect(totals.amount.toFixed(2)).toBe('100.00')
  })

  it('acumula a franquia que sobrou quando o contrato permite', () => {
    const totals = computeSdPeriodTotals([entry(30)], { carryOver: true }, 120)
    expect(totals.carriedMinutes).toBe(90)
    expect(totals.amount.toFixed(2)).toBe('0.00')
  })

  it('descarta a sobra quando o contrato não acumula', () => {
    const totals = computeSdPeriodTotals([entry(30)], { carryOver: false }, 120)
    expect(totals.carriedMinutes).toBe(0)
  })

  it('aplica o multiplicador da janela no excedente', () => {
    const totals = computeSdPeriodTotals(
      [entry(60, true, '100.00', '1.50')],
      { carryOver: false },
      0,
    )
    expect(totals.amount.toFixed(2)).toBe('150.00')
  })

  it('sem franquia cobra tudo', () => {
    const totals = computeSdPeriodTotals([entry(120)], { carryOver: true }, 0)
    expect(totals.coveredMinutes).toBe(0)
    expect(totals.overageMinutes).toBe(120)
    expect(totals.amount.toFixed(2)).toBe('200.00')
  })

  it('franquia negativa é tratada como zero', () => {
    const totals = computeSdPeriodTotals([entry(60)], { carryOver: false }, -30)
    expect(totals.overageMinutes).toBe(60)
  })

  it('minutos negativos não diminuem o total', () => {
    const totals = computeSdPeriodTotals([entry(-10)], { carryOver: false }, 0)
    expect(totals.usedMinutes).toBe(0)
    expect(totals.overageMinutes).toBe(0)
  })

  it('período sem apontamento acumula a franquia inteira', () => {
    const totals = computeSdPeriodTotals([], { carryOver: true }, 600)
    expect(totals.usedMinutes).toBe(0)
    expect(totals.carriedMinutes).toBe(600)
    expect(totals.amount.toFixed(2)).toBe('0.00')
  })
})

/* ------------------------------ janelas do ciclo ----------------------------- */

describe('sdPeriodRange', () => {
  it('mensal vai do dia 1 ao dia 1 do mês seguinte', () => {
    const { start, end } = sdPeriodRange(
      'MONTHLY',
      new Date('2026-10-17T10:00:00Z'),
    )
    expect(start.toISOString()).toBe('2026-10-01T00:00:00.000Z')
    expect(end.toISOString()).toBe('2026-11-01T00:00:00.000Z')
  })

  it('mensal vira o ano em dezembro', () => {
    const { end } = sdPeriodRange('MONTHLY', new Date('2026-12-31T23:00:00Z'))
    expect(end.toISOString()).toBe('2027-01-01T00:00:00.000Z')
  })

  it('trimestral é ancorado em jan/abr/jul/out', () => {
    const { start, end } = sdPeriodRange(
      'QUARTERLY',
      new Date('2026-11-05T00:00:00Z'),
    )
    expect(start.toISOString()).toBe('2026-10-01T00:00:00.000Z')
    expect(end.toISOString()).toBe('2027-01-01T00:00:00.000Z')
  })

  it('anual é o ano civil', () => {
    const { start, end } = sdPeriodRange(
      'YEARLY',
      new Date('2026-06-01T00:00:00Z'),
    )
    expect(start.toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(end.toISOString()).toBe('2027-01-01T00:00:00.000Z')
  })
})

describe('sdLocalDayStart / sdLocalDayRange', () => {
  it('meia-noite local em São Paulo é 03:00 UTC', () => {
    expect(
      sdLocalDayStart(
        new Date('2026-10-07T13:00:00Z'),
        'America/Sao_Paulo',
      ).toISOString(),
    ).toBe('2026-10-07T03:00:00.000Z')
  })

  it('um instante antes das 03:00 UTC ainda é o dia anterior', () => {
    expect(
      sdLocalDayStart(
        new Date('2026-10-07T02:00:00Z'),
        'America/Sao_Paulo',
      ).toISOString(),
    ).toBe('2026-10-06T03:00:00.000Z')
  })

  it('o dia dura 24 h fora de transição de fuso', () => {
    const { start, end } = sdLocalDayRange(
      new Date('2026-10-07T13:00:00Z'),
      calendar(),
    )
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000)
  })

  it('em UTC a meia-noite local é a UTC', () => {
    const { start } = sdLocalDayRange(
      new Date('2026-10-07T13:00:00Z'),
      calendar({ timezone: 'UTC', is24x7: true }),
    )
    expect(start.toISOString()).toBe('2026-10-07T00:00:00.000Z')
  })

  it('o dia encurta no início do horário de verão', () => {
    // Austrália/Sydney adianta uma hora no primeiro domingo de outubro.
    const { start, end } = sdLocalDayRange(
      new Date('2026-10-04T05:00:00Z'),
      calendar({ timezone: 'Australia/Sydney', is24x7: true }),
    )
    expect(end.getTime() - start.getTime()).toBe(23 * 60 * 60 * 1000)
  })

  it('usa o fuso padrão quando o calendário não vem', () => {
    const { start, end } = sdLocalDayRange(new Date('2026-10-07T13:00:00Z'))
    expect(start.toISOString()).toBe('2026-10-07T00:00:00.000Z')
    expect(end.toISOString()).toBe('2026-10-08T00:00:00.000Z')
  })
})

describe('sdContractCovers', () => {
  const base = {
    status: 'ACTIVE',
    startsAt: new Date('2026-01-01T00:00:00Z'),
    endsAt: null,
    ticketTypes: [] as ('INCIDENT' | 'CHANGE')[],
  }
  const at = new Date('2026-10-07T12:00:00Z')

  it('cobre quando está ativo, vigente e sem restrição de tipo', () => {
    expect(sdContractCovers(base, at, 'INCIDENT')).toBe(true)
  })

  it('recusa contrato que não está ativo', () => {
    expect(sdContractCovers({ ...base, status: 'DRAFT' }, at, 'INCIDENT')).toBe(
      false,
    )
    expect(
      sdContractCovers({ ...base, status: 'SUSPENDED' }, at, 'INCIDENT'),
    ).toBe(false)
  })

  it('recusa antes do início e a partir do término', () => {
    expect(
      sdContractCovers(
        { ...base, startsAt: new Date('2026-11-01T00:00:00Z') },
        at,
        'INCIDENT',
      ),
    ).toBe(false)
    expect(
      sdContractCovers(
        { ...base, endsAt: new Date('2026-10-01T00:00:00Z') },
        at,
        'INCIDENT',
      ),
    ).toBe(false)
  })

  it('sem tipo informado, confere só a vigência', () => {
    const scoped = { ...base, ticketTypes: ['CHANGE' as const] }
    expect(sdContractCovers(scoped, at)).toBe(true)
    expect(sdContractCovers({ ...scoped, status: 'ENDED' }, at)).toBe(false)
  })

  it('respeita os tipos cobertos', () => {
    const scoped = { ...base, ticketTypes: ['CHANGE' as const] }
    expect(sdContractCovers(scoped, at, 'CHANGE')).toBe(true)
    expect(sdContractCovers(scoped, at, 'INCIDENT')).toBe(false)
  })
})
