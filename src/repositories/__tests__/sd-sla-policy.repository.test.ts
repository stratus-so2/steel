import { describe, expect, it } from 'vitest'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { SdSlaPolicyRepository } from '../sd-sla-policy.repository'

async function seedPriorities(workspaceId: string) {
  const [p1, p2] = await Promise.all([
    prisma.sdPriority.create({ data: { workspaceId, name: 'P1', level: 4 } }),
    prisma.sdPriority.create({ data: { workspaceId, name: 'P2', level: 3 } }),
  ])
  return { p1, p2 }
}

describe('SdSlaPolicyRepository', () => {
  it('creates with targets, keeps a single default and syncs SdSettings', async () => {
    const workspace = await seedWorkspace()
    await prisma.sdSettings.create({
      data: { workspaceId: workspace.id, ticketPrefixes: {} },
    })
    const { p1, p2 } = await seedPriorities(workspace.id)

    const padrao = expectOk(
      await SdSlaPolicyRepository.create(
        workspace.id,
        { name: 'Padrão', isDefault: true, conditions: [] },
        [
          {
            priorityId: p2.id,
            firstResponseMinutes: 60,
            resolutionMinutes: 480,
          },
          {
            priorityId: p1.id,
            firstResponseMinutes: 30,
            resolutionMinutes: 240,
          },
        ],
      ),
    )
    expect(padrao.isDefault).toBe(true)
    expect(padrao.position).toBe(0)
    expect(padrao.targets.map((t) => t.firstResponseMinutes)).toEqual([30, 60])

    const critico = expectOk(
      await SdSlaPolicyRepository.create(
        workspace.id,
        { name: 'Crítico', isDefault: false },
        [],
      ),
    )
    expect(critico.position).toBe(1)
    expect(critico.isDefault).toBe(false)
    expect(
      expectOk(await SdSlaPolicyRepository.countDefaults(workspace.id)),
    ).toBe(1)

    const settings = await prisma.sdSettings.findUniqueOrThrow({
      where: { workspaceId: workspace.id },
    })
    expect(settings.defaultSlaPolicyId).toBe(padrao.id)

    // Update: vira padrão e troca as metas.
    const updated = expectOk(
      await SdSlaPolicyRepository.update(
        critico.id,
        workspace.id,
        { isDefault: true, name: 'Crítico 24×7' },
        [
          {
            priorityId: p1.id,
            firstResponseMinutes: 15,
            resolutionMinutes: 120,
          },
        ],
      ),
    )
    expect(updated.isDefault).toBe(true)
    expect(updated.targets).toHaveLength(1)
    expect(
      expectOk(await SdSlaPolicyRepository.findById(padrao.id, workspace.id))
        .isDefault,
    ).toBe(false)
    expect(
      (
        await prisma.sdSettings.findUniqueOrThrow({
          where: { workspaceId: workspace.id },
        })
      ).defaultSlaPolicyId,
    ).toBe(critico.id)

    // Update sem metas mantém as atuais; isDefault false desmarca.
    const kept = expectOk(
      await SdSlaPolicyRepository.update(critico.id, workspace.id, {
        isDefault: false,
      }),
    )
    expect(kept.targets).toHaveLength(1)
    expect(kept.isDefault).toBe(false)

    expectOk(await SdSlaPolicyRepository.setDefault(workspace.id, padrao.id))
    expect(
      expectOk(await SdSlaPolicyRepository.findById(padrao.id, workspace.id))
        .isDefault,
    ).toBe(true)

    expectOk(
      await SdSlaPolicyRepository.reorder(workspace.id, [
        critico.id,
        padrao.id,
      ]),
    )
    const list = expectOk(await SdSlaPolicyRepository.list(workspace.id))
    expect(list.map((p) => p.id)).toEqual([critico.id, padrao.id])

    expectOk(await SdSlaPolicyRepository.delete(critico.id, workspace.id))
    expectErr(
      await SdSlaPolicyRepository.findById(critico.id, workspace.id),
      'SD_CONFIG_NOT_FOUND',
    )
  })

  it('rejects foreign ids on reorder/update/delete', async () => {
    const [workspace, other] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
    ])
    const policy = expectOk(
      await SdSlaPolicyRepository.create(workspace.id, { name: 'X' }, []),
    )
    expectErr(
      await SdSlaPolicyRepository.reorder(other.id, [policy.id]),
      'SD_CONFIG_NOT_FOUND',
    )
    expectErr(
      await SdSlaPolicyRepository.update(policy.id, other.id, { name: 'Y' }),
      'SD_CONFIG_NOT_FOUND',
    )
    expectErr(
      await SdSlaPolicyRepository.delete(policy.id, other.id),
      'SD_CONFIG_NOT_FOUND',
    )
    expectErr(
      await SdSlaPolicyRepository.setDefault(other.id, policy.id),
      'SD_CONFIG_NOT_FOUND',
    )
  })
})
