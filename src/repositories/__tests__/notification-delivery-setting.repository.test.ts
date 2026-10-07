import { afterEach, describe, expect, it, vi } from 'vitest'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { NotificationDeliverySettingRepository } from '../notification-delivery-setting.repository'

describe('NotificationDeliverySettingRepository', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return null before the user decides', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])

    expect(
      expectOk(
        await NotificationDeliverySettingRepository.find(workspace.id, user.id),
      ),
    ).toBeNull()
  })

  it('should create, then update one row per user and workspace', async () => {
    const [workspace, otherWorkspace, user] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
      seedUser(),
    ])

    const created = expectOk(
      await NotificationDeliverySettingRepository.upsert(
        workspace.id,
        user.id,
        {
          browserEnabled: true,
        },
      ),
    )
    expect(created.browserEnabled).toBe(true)

    const updated = expectOk(
      await NotificationDeliverySettingRepository.upsert(
        workspace.id,
        user.id,
        {
          browserEnabled: false,
        },
      ),
    )
    expect(updated.id).toBe(created.id)
    expect(updated.browserEnabled).toBe(false)

    expect(
      expectOk(
        await NotificationDeliverySettingRepository.find(workspace.id, user.id),
      )?.browserEnabled,
    ).toBe(false)
    // Scoped by workspace.
    expect(
      expectOk(
        await NotificationDeliverySettingRepository.find(
          otherWorkspace.id,
          user.id,
        ),
      ),
    ).toBeNull()
  })

  it('should return DATABASE_ERROR on failures', async () => {
    const user = await seedUser()
    expectErr(
      await NotificationDeliverySettingRepository.upsert('missing', user.id, {
        browserEnabled: true,
      }),
      'DATABASE_ERROR',
    )

    vi.spyOn(
      prisma.notificationDeliverySetting,
      'findUnique',
    ).mockRejectedValue(new Error('boom'))
    expectErr(
      await NotificationDeliverySettingRepository.find('w', 'u'),
      'DATABASE_ERROR',
    )
  })
})
