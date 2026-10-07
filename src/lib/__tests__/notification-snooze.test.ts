import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SNOOZE_TIMEZONE,
  NOTIFICATION_SNOOZE_PRESETS,
  snoozeUntil,
} from '../notifications/snooze'

const SP = 'America/Sao_Paulo'
// Wednesday 2026-10-07, 10:00 in São Paulo (UTC-3).
const WEDNESDAY_MORNING = new Date('2026-10-07T13:00:00Z')

const iso = (date: Date) => date.toISOString()

describe('snoozeUntil', () => {
  it('should expose the four presets and the default timezone', () => {
    expect(NOTIFICATION_SNOOZE_PRESETS).toEqual([
      '1h',
      '3h',
      'tomorrow',
      'next-week',
    ])
    expect(DEFAULT_SNOOZE_TIMEZONE).toBe(SP)
  })

  it('should add one or three hours, regardless of the timezone', () => {
    expect(iso(snoozeUntil('1h', WEDNESDAY_MORNING, SP))).toBe(
      '2026-10-07T14:00:00.000Z',
    )
    expect(iso(snoozeUntil('3h', WEDNESDAY_MORNING))).toBe(
      '2026-10-07T16:00:00.000Z',
    )
  })

  it('should wake up tomorrow at 09:00 local time', () => {
    expect(iso(snoozeUntil('tomorrow', WEDNESDAY_MORNING, SP))).toBe(
      '2026-10-08T12:00:00.000Z',
    )
  })

  it('should still mean the next day late at night', () => {
    // Wednesday 23:30 in São Paulo (already Thursday in UTC).
    const lateNight = new Date('2026-10-08T02:30:00Z')
    expect(iso(snoozeUntil('tomorrow', lateNight, SP))).toBe(
      '2026-10-08T12:00:00.000Z',
    )
  })

  it('should never resolve "tomorrow" to later today, right after midnight', () => {
    // Thursday 00:30 in São Paulo: tomorrow is Friday.
    const afterMidnight = new Date('2026-10-08T03:30:00Z')
    expect(iso(snoozeUntil('tomorrow', afterMidnight, SP))).toBe(
      '2026-10-09T12:00:00.000Z',
    )
  })

  it('should wake up next Monday at 09:00', () => {
    expect(iso(snoozeUntil('next-week', WEDNESDAY_MORNING, SP))).toBe(
      '2026-10-12T12:00:00.000Z',
    )
  })

  it('should skip to the following Monday when today is Monday', () => {
    const monday = new Date('2026-10-12T13:00:00Z')
    expect(iso(snoozeUntil('next-week', monday, SP))).toBe(
      '2026-10-19T12:00:00.000Z',
    )
  })

  it('should land on tomorrow when today is Sunday', () => {
    const sunday = new Date('2026-10-11T13:00:00Z')
    expect(iso(snoozeUntil('next-week', sunday, SP))).toBe(
      '2026-10-12T12:00:00.000Z',
    )
  })

  it('should use the user timezone (Lisbon, UTC+1 in early October)', () => {
    expect(
      iso(snoozeUntil('tomorrow', WEDNESDAY_MORNING, 'Europe/Lisbon')),
    ).toBe('2026-10-08T08:00:00.000Z')
  })

  it('should follow a DST change (Lisbon back to UTC+0 on Oct 25)', () => {
    const saturday = new Date('2026-10-24T12:00:00Z')
    expect(iso(snoozeUntil('tomorrow', saturday, 'Europe/Lisbon'))).toBe(
      '2026-10-25T09:00:00.000Z',
    )
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty', ''],
    ['invalid', 'Mars/Olympus_Mons'],
  ])('should fall back to São Paulo for a %s timezone', (_label, timeZone) => {
    expect(iso(snoozeUntil('tomorrow', WEDNESDAY_MORNING, timeZone))).toBe(
      '2026-10-08T12:00:00.000Z',
    )
  })
})
