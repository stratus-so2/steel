import { describe, expect, it } from 'vitest'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { SdSettingsRepository } from '../sd-settings.repository'

describe('SdSettingsRepository', () => {
  it('getOrCreate creates the row with the default prefixes once', async () => {
    const workspace = await seedWorkspace()
    const first = expectOk(await SdSettingsRepository.getOrCreate(workspace.id))
    expect(first.ticketPrefixes).toEqual({
      INCIDENT: 'INC',
      SERVICE_REQUEST: 'REQ',
      CHANGE: 'CHG',
      PROBLEM: 'PRB',
    })
    const second = expectOk(
      await SdSettingsRepository.getOrCreate(workspace.id),
    )
    expect(second.id).toBe(first.id)
  })

  it('update creates the row when missing and updates it afterwards', async () => {
    const workspace = await seedWorkspace()
    const created = expectOk(
      await SdSettingsRepository.update(workspace.id, { slaAtRiskPercent: 70 }),
    )
    expect(created.slaAtRiskPercent).toBe(70)
    expect(created.ticketPrefixes).toMatchObject({ INCIDENT: 'INC' })

    const updated = expectOk(
      await SdSettingsRepository.update(workspace.id, {
        ticketPrefixes: {
          INCIDENT: 'INC',
          SERVICE_REQUEST: 'RQ',
          CHANGE: 'MUD',
          PROBLEM: 'PRB',
        },
        aiHandoffKeywords: ['humano'],
      }),
    )
    expect(updated.id).toBe(created.id)
    expect(updated.ticketPrefixes).toMatchObject({ CHANGE: 'MUD' })
    expect(updated.aiHandoffKeywords).toEqual(['humano'])
  })

  it('update with prefixes on a missing row stores them', async () => {
    const workspace = await seedWorkspace()
    const created = expectOk(
      await SdSettingsRepository.update(workspace.id, {
        ticketPrefixes: {
          INCIDENT: 'I',
          SERVICE_REQUEST: 'R',
          CHANGE: 'C',
          PROBLEM: 'P',
        },
      }),
    )
    expect(created.ticketPrefixes).toMatchObject({ INCIDENT: 'I' })
  })

  it('whatsappConnectionExists only accepts SERVICE_DESK connections of the workspace', async () => {
    const [workspace, other, user] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
      seedUser(),
    ])
    const connection = await prisma.whatsAppConnection.create({
      data: {
        workspaceId: workspace.id,
        label: 'SD',
        provider: 'META',
        createdById: user.id,
        phoneNumber: '5511999990000',
        module: 'SERVICE_DESK',
      },
    })
    const zap = await prisma.whatsAppConnection.create({
      data: {
        workspaceId: workspace.id,
        label: 'Zap',
        provider: 'META',
        createdById: user.id,
        phoneNumber: '5511999990001',
      },
    })

    expect(
      expectOk(
        await SdSettingsRepository.whatsappConnectionExists(
          workspace.id,
          connection.id,
        ),
      ),
    ).toBe(true)
    expect(
      expectOk(
        await SdSettingsRepository.whatsappConnectionExists(
          workspace.id,
          zap.id,
        ),
      ),
    ).toBe(false)
    expect(
      expectOk(
        await SdSettingsRepository.whatsappConnectionExists(
          other.id,
          connection.id,
        ),
      ),
    ).toBe(false)
  })
})
