import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SD_TICKET_PREFIXES,
  formatSdTicketCode,
  parseSdTicketCode,
  resolveSdTicketPrefixes,
} from '@/src/lib/servicedesk/ticket-code'

describe('resolveSdTicketPrefixes', () => {
  it('falls back to the defaults for missing or invalid entries', () => {
    expect(resolveSdTicketPrefixes(null)).toEqual(DEFAULT_SD_TICKET_PREFIXES)
    expect(resolveSdTicketPrefixes('x')).toEqual(DEFAULT_SD_TICKET_PREFIXES)
    expect(
      resolveSdTicketPrefixes({
        INCIDENT: ' inc2 ',
        SERVICE_REQUEST: '1REQ',
        CHANGE: 42,
        PROBLEM: 'MUITOLONGO123',
      }),
    ).toEqual({
      INCIDENT: 'INC2',
      SERVICE_REQUEST: 'REQ',
      CHANGE: 'CHG',
      PROBLEM: 'PRB',
    })
  })
})

describe('formatSdTicketCode', () => {
  it('pads the number to six digits', () => {
    expect(formatSdTicketCode('INCIDENT', 123)).toBe('INC-000123')
    expect(formatSdTicketCode('CHANGE', 1234567)).toBe('CHG-1234567')
    expect(
      formatSdTicketCode('PROBLEM', 7, {
        ...DEFAULT_SD_TICKET_PREFIXES,
        PROBLEM: 'PB',
      }),
    ).toBe('PB-000007')
  })
})

describe('parseSdTicketCode', () => {
  it.each([
    ['INC-000123', { type: 'INCIDENT', number: 123 }],
    ['req-5', { type: 'SERVICE_REQUEST', number: 5 }],
    ['CHG42', { type: 'CHANGE', number: 42 }],
    [' #17 ', { type: null, number: 17 }],
    ['99', { type: null, number: 99 }],
    ['0', null],
    ['INC-0', null],
    ['XYZ-1', null],
    ['INC-', null],
    ['abc', null],
    ['', null],
  ])('%s', (input, expected) => {
    expect(parseSdTicketCode(input)).toEqual(expected)
  })

  it('uses custom prefixes', () => {
    const prefixes = { ...DEFAULT_SD_TICKET_PREFIXES, INCIDENT: 'CH' }
    expect(parseSdTicketCode('CH-000010', prefixes)).toEqual({
      type: 'INCIDENT',
      number: 10,
    })
    expect(parseSdTicketCode('INC-10', prefixes)).toBeNull()
  })
})
