import { describe, expect, it } from 'vitest'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { SdClassificationRepository } from '../sd-classification.repository'

describe('SdClassificationRepository', () => {
  it('creates per kind with positions, filters, updates, reorders and deletes', async () => {
    const [workspace, other] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
    ])
    const falha = expectOk(
      await SdClassificationRepository.create(workspace.id, {
        kind: 'TICKET',
        name: 'Falha',
      }),
    )
    const duvida = expectOk(
      await SdClassificationRepository.create(workspace.id, {
        kind: 'TICKET',
        name: 'Dúvida',
        active: false,
      }),
    )
    const remoto = expectOk(
      await SdClassificationRepository.create(workspace.id, {
        kind: 'SOLUTION',
        name: 'Remoto',
      }),
    )
    expect([falha.position, duvida.position, remoto.position]).toEqual([
      0, 1, 0,
    ])

    expect(
      expectOk(await SdClassificationRepository.list(workspace.id)).map(
        (c) => c.name,
      ),
    ).toEqual(['Falha', 'Remoto'])
    expect(
      expectOk(
        await SdClassificationRepository.list(workspace.id, {
          kind: 'TICKET',
          includeInactive: true,
        }),
      ).map((c) => c.name),
    ).toEqual(['Falha', 'Dúvida'])
    expect(expectOk(await SdClassificationRepository.list(other.id))).toEqual(
      [],
    )

    expectErr(
      await SdClassificationRepository.findById(falha.id, other.id),
      'SD_CONFIG_NOT_FOUND',
    )
    expect(
      expectOk(
        await SdClassificationRepository.update(falha.id, workspace.id, {
          color: '#ef4444',
        }),
      ).color,
    ).toBe('#ef4444')

    expectOk(
      await SdClassificationRepository.reorder(workspace.id, [
        duvida.id,
        falha.id,
      ]),
    )
    expect(
      expectOk(
        await SdClassificationRepository.findById(duvida.id, workspace.id),
      ).position,
    ).toBe(0)

    expectOk(await SdClassificationRepository.delete(falha.id, workspace.id))
    expectErr(
      await SdClassificationRepository.delete(falha.id, workspace.id),
      'SD_CONFIG_NOT_FOUND',
    )
  })
})
