import { describe, expect, it } from 'vitest'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { SdCalendarRepository } from '../sd-calendar.repository'

const schedule = {
  mon: [['08:00', '18:00']],
  tue: [],
  wed: [],
  thu: [],
  fri: [],
  sat: [],
  sun: [],
}

describe('SdCalendarRepository', () => {
  it('creates, lists (default first), finds, updates and deletes', async () => {
    const [workspace, other] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
    ])
    const a = expectOk(
      await SdCalendarRepository.create(workspace.id, {
        name: 'B comercial',
        schedule,
        isDefault: true,
      }),
    )
    const b = expectOk(
      await SdCalendarRepository.create(workspace.id, {
        name: 'A plantão',
        schedule,
      }),
    )
    expect(
      expectOk(await SdCalendarRepository.countDefaults(workspace.id)),
    ).toBe(1)

    const list = expectOk(await SdCalendarRepository.list(workspace.id))
    expect(list.map((c) => c.id)).toEqual([a.id, b.id])
    expect(expectOk(await SdCalendarRepository.list(other.id))).toEqual([])

    expect(
      expectOk(await SdCalendarRepository.findById(b.id, workspace.id)).name,
    ).toBe('A plantão')
    expectErr(
      await SdCalendarRepository.findById(b.id, other.id),
      'SD_CONFIG_NOT_FOUND',
    )

    // Marcar B como padrão desmarca A.
    const updated = expectOk(
      await SdCalendarRepository.update(b.id, workspace.id, {
        isDefault: true,
        holidays: [{ date: '2026-12-25', name: 'Natal', recurring: true }],
      }),
    )
    expect(updated.isDefault).toBe(true)
    expect(
      expectOk(await SdCalendarRepository.findById(a.id, workspace.id))
        .isDefault,
    ).toBe(false)

    // Atualização sem padrão não mexe nos outros.
    expectOk(
      await SdCalendarRepository.update(a.id, workspace.id, { name: 'Novo' }),
    )
    expect(
      expectOk(await SdCalendarRepository.findById(b.id, workspace.id))
        .isDefault,
    ).toBe(true)

    expectErr(
      await SdCalendarRepository.update(a.id, other.id, { name: 'x' }),
      'SD_CONFIG_NOT_FOUND',
    )

    expectOk(await SdCalendarRepository.delete(a.id, workspace.id))
    expectErr(
      await SdCalendarRepository.delete(a.id, workspace.id),
      'SD_CONFIG_NOT_FOUND',
    )
  })

  it('creating a non-default calendar keeps the current default', async () => {
    const workspace = await seedWorkspace()
    const a = expectOk(
      await SdCalendarRepository.create(workspace.id, {
        name: 'A',
        schedule,
        isDefault: true,
      }),
    )
    expectOk(
      await SdCalendarRepository.create(workspace.id, {
        name: 'B',
        schedule,
        isDefault: false,
      }),
    )
    expect(
      expectOk(await SdCalendarRepository.findById(a.id, workspace.id))
        .isDefault,
    ).toBe(true)
  })
})
