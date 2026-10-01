import { describe, expect, it } from 'vitest'
import {
  parseSdMonitorPayload,
  SD_ZABBIX_MEDIA_TYPE_FIELDS,
  sdMonitorPriorityId,
  sdMonitorSeverityMap,
  sdMonitorTicketBody,
  sdZabbixPayloadExample,
} from '../servicedesk/monitoring'

/** Corpo que o tipo de mídia do Zabbix manda num problema. */
const zabbix = {
  eventId: '31415',
  eventValue: '1',
  eventStatus: 'PROBLEM',
  eventName: 'Sem resposta do agente no SRV-01',
  eventSeverity: 'Disaster',
  eventDate: '2026.10.01',
  eventTime: '14:03:12',
  eventTags: 'scope: availability, service: rede',
  hostName: 'SRV-01',
  hostIp: '10.0.0.4',
  message: 'ICMP ping falhou há 5 minutos',
}

describe('parseSdMonitorPayload — Zabbix', () => {
  it('reads every documented media-type field', () => {
    const event = parseSdMonitorPayload(zabbix)
    expect(event).not.toBeNull()
    if (!event) return
    expect(event.externalId).toBe('31415')
    expect(event.resolved).toBe(false)
    expect(event.subject).toBe('Sem resposta do agente no SRV-01')
    expect(event.severity).toBe('Disaster')
    expect(event.host).toBe('SRV-01')
    expect(event.body).toBe('ICMP ping falhou há 5 minutos')
    expect(event.tags).toEqual(['scope: availability', 'service: rede'])
    // `{EVENT.DATE}`/`{EVENT.TIME}` vêm sem fuso: valem como hora local.
    expect(event.startedAt?.getTime()).toBe(
      new Date('2026-10-01T14:03:12').getTime(),
    )
  })

  it('treats RESOLVED and {EVENT.VALUE} 0 as a recovery', () => {
    expect(
      parseSdMonitorPayload({ ...zabbix, eventStatus: 'RESOLVED' })?.resolved,
    ).toBe(true)
    const { eventStatus: _ignored, ...withoutStatus } = zabbix
    expect(
      parseSdMonitorPayload({ ...withoutStatus, eventValue: '0' })?.resolved,
    ).toBe(true)
    expect(
      parseSdMonitorPayload({ ...withoutStatus, eventValue: 1 })?.resolved,
    ).toBe(false)
  })

  it('falls back to the host ip and to the alert message', () => {
    const event = parseSdMonitorPayload({
      eventId: '7',
      hostIp: '10.0.0.4',
      message: 'Disco cheio\nsegunda linha',
    })
    expect(event?.host).toBe('10.0.0.4')
    expect(event?.subject).toBe('Disco cheio')
    expect(event?.body).toBe('Disco cheio\nsegunda linha')
  })

  it('documents the exact script fields and renders the example body', () => {
    expect(SD_ZABBIX_MEDIA_TYPE_FIELDS).toContainEqual([
      'eventId',
      '{EVENT.ID}',
    ])
    const example = sdZabbixPayloadExample()
    expect(example).toContain('"eventId": "{EVENT.ID}"')
    expect(example).toContain('"hostName": "{HOST.NAME}"')
    expect(JSON.parse(example).eventSeverity).toBe('{EVENT.SEVERITY}')
  })
})

describe('parseSdMonitorPayload — generic', () => {
  it('reads the documented generic shape', () => {
    const event = parseSdMonitorPayload({
      externalId: 'cpu-srv2',
      status: 'PROBLEM',
      severity: 'high',
      host: 'srv-02',
      subject: 'CPU acima de 90%',
      body: 'Média de 5 minutos em 94%',
      tags: ['infra', 'cpu', 'infra'],
      startedAt: '2026-10-01T12:00:00.000Z',
    })
    expect(event?.externalId).toBe('cpu-srv2')
    expect(event?.tags).toEqual(['infra', 'cpu'])
    expect(event?.startedAt?.toISOString()).toBe('2026-10-01T12:00:00.000Z')
  })

  it.each([
    ['ok', true],
    ['RESOLVED', true],
    ['recovered', true],
    ['firing', false],
    ['problem', false],
  ])('maps the status %s', (status, resolved) => {
    expect(parseSdMonitorPayload({ subject: 'x', status })?.resolved).toBe(
      resolved,
    )
  })

  it('defaults to a problem when no status comes at all', () => {
    expect(parseSdMonitorPayload({ subject: 'x' })?.resolved).toBe(false)
  })

  it('derives a stable key when the alert has no id', () => {
    const first = parseSdMonitorPayload({ host: 'srv-03', subject: 'Queda' })
    const again = parseSdMonitorPayload({ host: 'srv-03', subject: 'Queda' })
    const other = parseSdMonitorPayload({ host: 'srv-04', subject: 'Queda' })
    expect(first?.externalId).toMatch(/^auto:[0-9a-f]{32}$/)
    expect(again?.externalId).toBe(first?.externalId)
    expect(other?.externalId).not.toBe(first?.externalId)
  })

  it('accepts tags as an object map and as a comma separated string', () => {
    expect(
      parseSdMonitorPayload({ subject: 'x', tags: { env: 'prod' } })?.tags,
    ).toEqual(['env: prod'])
    expect(parseSdMonitorPayload({ subject: 'x', tags: 'a, b' })?.tags).toEqual(
      ['a', 'b'],
    )
    expect(parseSdMonitorPayload({ subject: 'x', tags: [1, 2] })?.tags).toEqual(
      [],
    )
    expect(parseSdMonitorPayload({ subject: 'x', tags: 7 })?.tags).toEqual([])
  })

  it('reads epoch seconds, epoch millis and unparsable dates', () => {
    expect(
      parseSdMonitorPayload({ subject: 'x', timestamp: '1790000000' })
        ?.startedAt,
    ).toBeInstanceOf(Date)
    expect(
      parseSdMonitorPayload({ subject: 'x', timestamp: '1790000000000' })
        ?.startedAt,
    ).toBeInstanceOf(Date)
    expect(
      parseSdMonitorPayload({ subject: 'x', startedAt: 'ontem' })?.startedAt,
    ).toBeNull()
    expect(
      parseSdMonitorPayload({ subject: 'x', eventDate: 'não é data' })
        ?.startedAt,
    ).toBeNull()
    expect(parseSdMonitorPayload({ subject: 'x' })?.startedAt).toBeNull()
  })

  it('truncates a very long subject and body', () => {
    const event = parseSdMonitorPayload({
      subject: 'a'.repeat(400),
      body: 'b'.repeat(9000),
      externalId: 'x'.repeat(300),
    })
    expect(event?.subject).toHaveLength(200)
    expect(event?.body).toHaveLength(8000)
    expect(event?.externalId).toHaveLength(200)
  })

  it('refuses what cannot become an alert', () => {
    expect(parseSdMonitorPayload(null)).toBeNull()
    expect(parseSdMonitorPayload('texto')).toBeNull()
    expect(parseSdMonitorPayload([{ subject: 'x' }])).toBeNull()
    expect(parseSdMonitorPayload({})).toBeNull()
    expect(parseSdMonitorPayload({ host: 'srv' })).toBeNull()
    expect(parseSdMonitorPayload({ subject: '   \n  ' })).toBeNull()
  })

  it('accepts a boolean flag as a scalar value', () => {
    expect(
      parseSdMonitorPayload({ subject: 'x', status: false })?.resolved,
    ).toBe(true)
  })
})

describe('sdMonitorSeverityMap / sdMonitorPriorityId', () => {
  const map = [
    { from: 'Disaster', priorityId: 'p-critica' },
    { from: 'warning', priorityId: 'p-baixa' },
  ]

  it('matches the severity ignoring case and spacing', () => {
    expect(sdMonitorPriorityId(map, 'disaster')).toBe('p-critica')
    expect(sdMonitorPriorityId(map, ' WARNING ')).toBe('p-baixa')
    expect(sdMonitorPriorityId(map, 'average')).toBeNull()
    expect(sdMonitorPriorityId(map, null)).toBeNull()
  })

  it('reads the stored json and drops broken entries', () => {
    expect(
      sdMonitorSeverityMap([
        { from: 'high', priorityId: 'p1' },
        { from: 'high' },
        { priorityId: 'p2' },
        'lixo',
        null,
      ]),
    ).toEqual([{ from: 'high', priorityId: 'p1' }])
    expect(sdMonitorSeverityMap('lixo')).toEqual([])
  })
})

describe('sdMonitorTicketBody', () => {
  it('describes the alert and escapes the content', () => {
    const event = parseSdMonitorPayload({
      ...zabbix,
      eventName: 'CPU <alta> & "quente"',
      message: 'linha 1\nlinha 2',
    })
    expect(event).not.toBeNull()
    if (!event) return
    const html = sdMonitorTicketBody(event, 'Zabbix matriz')
    expect(html).toContain('<strong>Origem:</strong> Zabbix matriz')
    expect(html).toContain('<strong>Host:</strong> SRV-01')
    expect(html).toContain('<strong>Severidade:</strong> Disaster')
    expect(html).toContain('<strong>Identificador:</strong> 31415')
    expect(html).toContain('scope: availability')
    expect(html).toContain('linha 1<br />linha 2')
    expect(html).not.toContain('<alta>')
  })

  it('omits the empty rows', () => {
    const event = parseSdMonitorPayload({ externalId: 'a', subject: 'Queda' })
    expect(event).not.toBeNull()
    if (!event) return
    const html = sdMonitorTicketBody(event, 'Webhook')
    expect(html).not.toContain('Host:')
    expect(html).not.toContain('Severidade:')
    expect(html).not.toContain('Tags:')
  })
})
