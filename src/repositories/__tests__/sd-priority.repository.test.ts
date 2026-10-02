import { describe, expect, it } from 'vitest'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { SD_SCALE_KINDS } from '@/src/schemas/sd-priority.schema'
import { SdPriorityRepository } from '../sd-priority.repository'

describe('SdPriorityRepository — scales', () => {
  it.each(SD_SCALE_KINDS)(
    'CRUD for %s with unique level per workspace',
    async (kind) => {
      const [workspace, other] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
      ])
      const high = expectOk(
        await SdPriorityRepository.create(kind, workspace.id, {
          name: 'Alto',
          level: 3,
          description: 'desc',
          color: '#ff0000',
        }),
      )
      const low = expectOk(
        await SdPriorityRepository.create(kind, workspace.id, {
          name: 'Baixo',
          level: 1,
        }),
      )
      // Colunas que a tabela não tem são ignoradas.
      expect(high.description ?? null).toBe(kind === 'priority' ? null : 'desc')
      expect(high.color ?? null).toBe(
        kind === 'priority' || kind === 'severity' ? '#ff0000' : null,
      )

      expect(
        expectOk(await SdPriorityRepository.list(kind, workspace.id)).map(
          (r) => r.level,
        ),
      ).toEqual([1, 3])
      expect(
        expectOk(await SdPriorityRepository.count(kind, workspace.id)),
      ).toBe(2)

      const conflict = expectErr(
        await SdPriorityRepository.create(kind, workspace.id, {
          name: 'Outro',
          level: 3,
        }),
        'SD_CONFIG_CONFLICT',
      )
      expect(conflict.message).toBe('Já existe um item com este nível')

      // Outra workspace pode repetir o nível.
      expectOk(
        await SdPriorityRepository.create(kind, other.id, {
          name: 'X',
          level: 3,
        }),
      )

      expectErr(
        await SdPriorityRepository.findById(kind, low.id, other.id),
        'SD_CONFIG_NOT_FOUND',
      )
      const renamed = expectOk(
        await SdPriorityRepository.update(kind, low.id, workspace.id, {
          name: 'Muito baixo',
          level: 2,
        }),
      )
      expect(renamed).toMatchObject({ name: 'Muito baixo', level: 2 })
      expectErr(
        await SdPriorityRepository.update(kind, low.id, workspace.id, {
          level: 3,
        }),
        'SD_CONFIG_CONFLICT',
      )

      expectOk(await SdPriorityRepository.delete(kind, low.id, workspace.id))
      expectErr(
        await SdPriorityRepository.findById(kind, low.id, workspace.id),
        'SD_CONFIG_NOT_FOUND',
      )
    },
  )

  it('keeps a single default priority on create and update', async () => {
    const workspace = await seedWorkspace()
    const a = expectOk(
      await SdPriorityRepository.create('priority', workspace.id, {
        name: 'P3',
        level: 2,
        isDefault: true,
      }),
    )
    const b = expectOk(
      await SdPriorityRepository.create('priority', workspace.id, {
        name: 'P2',
        level: 3,
        isDefault: true,
      }),
    )
    let list = expectOk(
      await SdPriorityRepository.list('priority', workspace.id),
    )
    expect(list.filter((p) => p.isDefault).map((p) => p.id)).toEqual([b.id])

    expectOk(
      await SdPriorityRepository.update('priority', a.id, workspace.id, {
        isDefault: true,
      }),
    )
    list = expectOk(await SdPriorityRepository.list('priority', workspace.id))
    expect(list.filter((p) => p.isDefault).map((p) => p.id)).toEqual([a.id])
  })
})

describe('SdPriorityRepository — matrix', () => {
  it('replaces the whole grid', async () => {
    const workspace = await seedWorkspace()
    const impact = expectOk(
      await SdPriorityRepository.create('impact', workspace.id, {
        name: 'Alto',
        level: 3,
      }),
    )
    const urgencyA = expectOk(
      await SdPriorityRepository.create('urgency', workspace.id, {
        name: 'Alta',
        level: 3,
      }),
    )
    const urgencyB = expectOk(
      await SdPriorityRepository.create('urgency', workspace.id, {
        name: 'Baixa',
        level: 1,
      }),
    )
    const p1 = expectOk(
      await SdPriorityRepository.create('priority', workspace.id, {
        name: 'P1',
        level: 4,
      }),
    )

    const first = expectOk(
      await SdPriorityRepository.saveMatrix(workspace.id, [
        { impactId: impact.id, urgencyId: urgencyA.id, priorityId: p1.id },
        { impactId: impact.id, urgencyId: urgencyB.id, priorityId: p1.id },
      ]),
    )
    expect(first).toHaveLength(2)

    expectOk(
      await SdPriorityRepository.saveMatrix(workspace.id, [
        { impactId: impact.id, urgencyId: urgencyA.id, priorityId: p1.id },
      ]),
    )
    const cells = expectOk(await SdPriorityRepository.listMatrix(workspace.id))
    expect(cells.map((c) => c.urgencyId)).toEqual([urgencyA.id])
  })
})
