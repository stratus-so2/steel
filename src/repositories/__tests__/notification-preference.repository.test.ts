import { describe, expect, it, vi } from 'vitest'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { NotificationPreferenceRepository } from '../notification-preference.repository'

describe('NotificationPreferenceRepository', () => {
  it('should upsert, list and resolve muted users per workspace and kind', async () => {
    const [workspace, other, alice, bob] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
      seedUser(),
      seedUser(),
    ])

    expect(
      expectOk(
        await NotificationPreferenceRepository.upsertMany(
          workspace.id,
          alice.id,
          [
            { kind: 'CRM_TASK_DUE', inApp: false },
            { kind: 'MEMBER_JOINED', inApp: true },
          ],
        ),
      ),
    ).toBe(2)
    // Same kind again: updates the row instead of duplicating it.
    expectOk(
      await NotificationPreferenceRepository.upsertMany(
        workspace.id,
        alice.id,
        [{ kind: 'MEMBER_JOINED', inApp: false }],
      ),
    )
    // Bob muted the same kind, but in another workspace.
    expectOk(
      await NotificationPreferenceRepository.upsertMany(other.id, bob.id, [
        { kind: 'CRM_TASK_DUE', inApp: false },
      ]),
    )

    const rows = expectOk(
      await NotificationPreferenceRepository.listByUser(workspace.id, alice.id),
    )
    expect(rows.map((r) => [r.kind, r.inApp])).toEqual([
      ['CRM_TASK_DUE', false],
      ['MEMBER_JOINED', false],
    ])

    expect(
      expectOk(
        await NotificationPreferenceRepository.listMutedUserIds(
          workspace.id,
          'CRM_TASK_DUE',
          [alice.id, bob.id],
        ),
      ),
    ).toEqual([alice.id])
    expect(
      expectOk(
        await NotificationPreferenceRepository.listMutedUserIds(
          workspace.id,
          'CRM_DEAL_CLOSED',
          [alice.id],
        ),
      ),
    ).toEqual([])
  })

  it('should short-circuit an empty candidate list', async () => {
    const spy = vi.spyOn(prisma.notificationPreference, 'findMany')

    expect(
      expectOk(
        await NotificationPreferenceRepository.listMutedUserIds(
          'ws',
          'CRM_TASK_DUE',
          [],
        ),
      ),
    ).toEqual([])
    expect(spy).not.toHaveBeenCalled()
  })

  it('should map database failures to DATABASE_ERROR', async () => {
    vi.spyOn(prisma.notificationPreference, 'findMany').mockRejectedValue(
      new Error('down'),
    )
    vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(new Error('down'))

    expectErr(
      await NotificationPreferenceRepository.listByUser('ws', 'u'),
      'DATABASE_ERROR',
    )
    expectErr(
      await NotificationPreferenceRepository.listMutedUserIds(
        'ws',
        'CRM_TASK_DUE',
        ['u'],
      ),
      'DATABASE_ERROR',
    )
    expectErr(
      await NotificationPreferenceRepository.upsertMany('ws', 'u', [
        { kind: 'CRM_TASK_DUE', inApp: false },
      ]),
      'DATABASE_ERROR',
    )
  })
})
