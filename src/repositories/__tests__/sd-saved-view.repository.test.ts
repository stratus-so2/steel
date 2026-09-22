import { describe, expect, it, vi } from 'vitest'
import { seedSdSavedView } from '@/src/__tests__/factories/sd-ticket.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { SdSavedViewRepository } from '../sd-saved-view.repository'

describe('SdSavedViewRepository', () => {
  it('lists own and shared views of the workspace', async () => {
    const [workspace, other, me, you] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
      seedUser(),
      seedUser(),
    ])
    const mine = await seedSdSavedView(workspace.id, me.id, { position: 0 })
    const shared = await seedSdSavedView(workspace.id, you.id, {
      shared: true,
      position: 1,
    })
    await seedSdSavedView(workspace.id, you.id, { position: 2 })
    await seedSdSavedView(other.id, me.id)
    expect(
      expectOk(
        await SdSavedViewRepository.listVisible(workspace.id, me.id),
      ).map((v) => v.id),
    ).toEqual([mine.id, shared.id])
  })

  it('creates with an automatic position, updates, finds and deletes', async () => {
    const [workspace, other, me] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
      seedUser(),
    ])
    const a = expectOk(
      await SdSavedViewRepository.create({
        workspaceId: workspace.id,
        userId: me.id,
        name: 'A',
      }),
    )
    const b = expectOk(
      await SdSavedViewRepository.create({
        workspaceId: workspace.id,
        userId: me.id,
        name: 'B',
      }),
    )
    const c = expectOk(
      await SdSavedViewRepository.create({
        workspaceId: workspace.id,
        userId: me.id,
        name: 'C',
        position: 9,
      }),
    )
    expect([a.position, b.position, c.position]).toEqual([0, 1, 9])

    const updated = expectOk(
      await SdSavedViewRepository.update(a.id, { name: 'A2', shared: true }),
    )
    expect(updated).toMatchObject({ name: 'A2', shared: true })
    expect(
      expectOk(await SdSavedViewRepository.findById(a.id, workspace.id)).id,
    ).toBe(a.id)
    expectErr(
      await SdSavedViewRepository.findById(a.id, other.id),
      'RESOURCE_NOT_FOUND',
    )
    expectOk(await SdSavedViewRepository.delete(a.id))
    expectErr(
      await SdSavedViewRepository.findById(a.id, workspace.id),
      'RESOURCE_NOT_FOUND',
    )
  })

  it('maps failures to DATABASE_ERROR', async () => {
    const boom = () => Promise.reject(new Error('boom'))
    const spies = (
      ['findMany', 'findFirst', 'count', 'update', 'delete'] as const
    ).map((m) =>
      vi.spyOn(prisma.sdSavedView, m).mockImplementation(boom as never),
    )
    expectErr(
      await SdSavedViewRepository.listVisible('w', 'u'),
      'DATABASE_ERROR',
    )
    expectErr(await SdSavedViewRepository.findById('v', 'w'), 'DATABASE_ERROR')
    expectErr(
      await SdSavedViewRepository.create({
        workspaceId: 'w',
        userId: 'u',
        name: 'x',
      }),
      'DATABASE_ERROR',
    )
    expectErr(await SdSavedViewRepository.update('v', {}), 'DATABASE_ERROR')
    expectErr(await SdSavedViewRepository.delete('v'), 'DATABASE_ERROR')
    for (const spy of spies) spy.mockRestore()
  })
})
