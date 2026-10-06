import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import {
  PLATFORM_AI_SETTINGS_ID,
  PlatformAiSettingsRepository,
} from '../platform-ai-settings.repository'

// Not in the shared TRUNCATE list (no FK to users): clean the single row here.
beforeEach(async () => {
  await prisma.platformAiSettings.deleteMany()
})
afterEach(async () => {
  await prisma.platformAiSettings.deleteMany()
})

describe('PlatformAiSettingsRepository', () => {
  it('should return null until the first save, then upsert the single row', async () => {
    expect(expectOk(await PlatformAiSettingsRepository.find())).toBeNull()

    const created = expectOk(
      await PlatformAiSettingsRepository.upsert({
        costMargin: 1.3,
        updatedById: 'admin1',
      }),
    )
    expect(created.id).toBe(PLATFORM_AI_SETTINGS_ID)
    expect(created.costMargin.toNumber()).toBe(1.3)

    const updated = expectOk(
      await PlatformAiSettingsRepository.upsert({
        costMargin: 2.5,
        updatedById: 'admin2',
      }),
    )
    expect(updated.costMargin.toNumber()).toBe(2.5)
    expect(updated.updatedById).toBe('admin2')

    const found = expectOk(await PlatformAiSettingsRepository.find())
    expect(found?.costMargin.toNumber()).toBe(2.5)
    expect(await prisma.platformAiSettings.count()).toBe(1)
  })

  it('should return DATABASE_ERROR on failures', async () => {
    vi.spyOn(prisma.platformAiSettings, 'findUnique').mockRejectedValueOnce(
      new Error('down'),
    )
    expectErr(await PlatformAiSettingsRepository.find(), 'DATABASE_ERROR')
    vi.spyOn(prisma.platformAiSettings, 'upsert').mockRejectedValueOnce(
      new Error('down'),
    )
    expectErr(
      await PlatformAiSettingsRepository.upsert({
        costMargin: 1,
        updatedById: 'a',
      }),
      'DATABASE_ERROR',
    )
  })
})
