import { describe, expect, it } from 'vitest'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { SdCategoryRepository } from '../sd-category.repository'

describe('SdCategoryRepository', () => {
  it('creates the tree with positions per parent and filters by type/active', async () => {
    const [workspace, other] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
    ])
    const infra = expectOk(
      await SdCategoryRepository.create(workspace.id, {
        name: 'Infraestrutura',
        level: 'CATEGORY',
      }),
    )
    const acessos = expectOk(
      await SdCategoryRepository.create(workspace.id, {
        name: 'Acessos',
        level: 'CATEGORY',
        ticketTypes: ['SERVICE_REQUEST'],
      }),
    )
    const rede = expectOk(
      await SdCategoryRepository.create(workspace.id, {
        name: 'Rede',
        level: 'SUBCATEGORY',
        parentId: infra.id,
      }),
    )
    const old = expectOk(
      await SdCategoryRepository.create(workspace.id, {
        name: 'Antigo',
        level: 'CATEGORY',
        active: false,
      }),
    )
    expect([infra.position, acessos.position, rede.position]).toEqual([0, 1, 0])

    const incident = expectOk(
      await SdCategoryRepository.list(workspace.id, { ticketType: 'INCIDENT' }),
    )
    expect(incident.map((c) => c.name)).toEqual(['Infraestrutura', 'Rede'])
    const request = expectOk(
      await SdCategoryRepository.list(workspace.id, {
        ticketType: 'SERVICE_REQUEST',
      }),
    )
    expect(request.map((c) => c.name).sort()).toEqual(
      ['Acessos', 'Infraestrutura', 'Rede'].sort(),
    )
    const all = expectOk(
      await SdCategoryRepository.list(workspace.id, { includeInactive: true }),
    )
    expect(all.map((c) => c.id)).toContain(old.id)
    expect(expectOk(await SdCategoryRepository.list(other.id))).toEqual([])

    expect(expectOk(await SdCategoryRepository.countChildren(infra.id))).toBe(1)
    expectErr(
      await SdCategoryRepository.findById(infra.id, other.id),
      'SD_CATEGORY_NOT_FOUND',
    )

    const updated = expectOk(
      await SdCategoryRepository.update(rede.id, workspace.id, {
        name: 'Redes',
        portalVisible: false,
      }),
    )
    expect(updated.portalVisible).toBe(false)

    expectOk(
      await SdCategoryRepository.reorder(workspace.id, [acessos.id, infra.id]),
    )
    expect(
      expectOk(await SdCategoryRepository.findById(acessos.id, workspace.id))
        .position,
    ).toBe(0)

    // Excluir a raiz leva a subárvore junto.
    expectOk(await SdCategoryRepository.delete(infra.id, workspace.id))
    expectErr(
      await SdCategoryRepository.findById(rede.id, workspace.id),
      'SD_CATEGORY_NOT_FOUND',
    )
    expectErr(
      await SdCategoryRepository.delete(infra.id, workspace.id),
      'SD_CONFIG_NOT_FOUND',
    )
  })
})
