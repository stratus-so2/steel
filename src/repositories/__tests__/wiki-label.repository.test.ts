import { afterAll, describe, expect, it, vi } from 'vitest'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWikiPage } from '@/src/__tests__/factories/wiki-page.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { WikiLabelRepository } from '../wiki-label.repository'
import { WikiPageRepository } from '../wiki-page.repository'
import { WikiSettingsRepository } from '../wiki-settings.repository'

afterAll(() => {
  vi.restoreAllMocks()
})

async function seedLabel(workspaceId: string, name = 'RH') {
  return expectOk(
    await WikiLabelRepository.create({ workspaceId, name, color: 'green' }),
  )
}

describe('WikiLabelRepository', () => {
  it('should create, find, rename and delete a label', async () => {
    const workspace = await seedWorkspace()
    const created = await seedLabel(workspace.id)

    expect(expectOk(await WikiLabelRepository.findById(created.id)).name).toBe(
      'RH',
    )
    const renamed = expectOk(
      await WikiLabelRepository.update(created.id, { name: 'Pessoas' }),
    )
    expect(renamed.name).toBe('Pessoas')

    expectOk(await WikiLabelRepository.delete(created.id))
    expectErr(
      await WikiLabelRepository.findById(created.id),
      'WIKI_LABEL_NOT_FOUND',
    )
  })

  it('should refuse a duplicate name in the same workspace', async () => {
    const workspace = await seedWorkspace()
    const first = await seedLabel(workspace.id, 'RH')
    await seedLabel(workspace.id, 'TI')

    expectErr(
      await WikiLabelRepository.create({
        workspaceId: workspace.id,
        name: 'RH',
        color: 'red',
      }),
      'WIKI_LABEL_CONFLICT',
    )
    expectErr(
      await WikiLabelRepository.update(first.id, { name: 'TI' }),
      'WIKI_LABEL_CONFLICT',
    )
  })

  it('should count live pages per label and keep it on the page', async () => {
    const workspace = await seedWorkspace()
    const user = await seedUser()
    const label = await seedLabel(workspace.id)
    const page = await seedWikiPage(workspace.id, user.id)
    const archived = await seedWikiPage(workspace.id, user.id)
    await prisma.wikiPage.update({
      where: { id: archived.id },
      data: { archivedAt: new Date() },
    })

    expectOk(await WikiLabelRepository.setPageLabels(page.id, [label.id]))
    expectOk(await WikiLabelRepository.setPageLabels(archived.id, [label.id]))

    const [listed] = expectOk(
      await WikiLabelRepository.listByWorkspace(workspace.id),
    )
    expect(listed.pageCount).toBe(1)
    expect(expectOk(await WikiPageRepository.findById(page.id)).labels).toEqual(
      [{ labelId: label.id }],
    )
    expect(
      expectOk(
        await WikiLabelRepository.countInWorkspace(workspace.id, [
          label.id,
          'foreign',
        ]),
      ),
    ).toBe(1)

    expectOk(await WikiLabelRepository.setPageLabels(page.id, []))
    expect(expectOk(await WikiPageRepository.findById(page.id)).labels).toEqual(
      [],
    )
  })

  it('should return DATABASE_ERROR when a query throws', async () => {
    vi.spyOn(prisma.wikiLabel, 'findUnique').mockRejectedValueOnce(
      new Error('boom'),
    )
    vi.spyOn(prisma.wikiLabel, 'findMany').mockRejectedValueOnce(
      new Error('boom'),
    )
    vi.spyOn(prisma.wikiLabel, 'count').mockRejectedValueOnce(new Error('boom'))
    vi.spyOn(prisma.wikiLabel, 'create').mockRejectedValueOnce(
      new Error('boom'),
    )
    vi.spyOn(prisma.wikiLabel, 'update').mockRejectedValueOnce(
      new Error('boom'),
    )
    vi.spyOn(prisma.wikiLabel, 'delete').mockRejectedValueOnce(
      new Error('boom'),
    )
    vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(new Error('boom'))

    expectErr(await WikiLabelRepository.findById('x'), 'DATABASE_ERROR')
    expectErr(await WikiLabelRepository.listByWorkspace('x'), 'DATABASE_ERROR')
    expectErr(
      await WikiLabelRepository.countInWorkspace('x', ['y']),
      'DATABASE_ERROR',
    )
    expectErr(
      await WikiLabelRepository.create({
        workspaceId: 'x',
        name: 'n',
        color: 'gray',
      }),
      'DATABASE_ERROR',
    )
    expectErr(
      await WikiLabelRepository.update('x', { name: 'n' }),
      'DATABASE_ERROR',
    )
    expectErr(await WikiLabelRepository.delete('x'), 'DATABASE_ERROR')
    expectErr(
      await WikiLabelRepository.setPageLabels('x', []),
      'DATABASE_ERROR',
    )
  })
})

describe('WikiSettingsRepository', () => {
  it('should start off and flip the workspace toggle', async () => {
    const workspace = await seedWorkspace()

    expect(expectOk(await WikiSettingsRepository.isEnabled(workspace.id))).toBe(
      false,
    )
    expect(
      expectOk(await WikiSettingsRepository.setEnabled(workspace.id, true)),
    ).toBe(true)
    expect(expectOk(await WikiSettingsRepository.isEnabled(workspace.id))).toBe(
      true,
    )
  })

  it('should return NOT_FOUND for an unknown workspace', async () => {
    expectErr(
      await WikiSettingsRepository.isEnabled('nope'),
      'RESOURCE_NOT_FOUND',
    )
  })

  it('should return DATABASE_ERROR when a query throws', async () => {
    vi.spyOn(prisma.workspace, 'findUnique').mockRejectedValueOnce(
      new Error('boom'),
    )
    expectErr(await WikiSettingsRepository.isEnabled('x'), 'DATABASE_ERROR')
    expectErr(
      await WikiSettingsRepository.setEnabled('missing', true),
      'DATABASE_ERROR',
    )
  })
})

describe('WikiPageRepository.listMembers()', () => {
  it('should search members by name', async () => {
    const workspace = await seedWorkspace()
    const ana = await seedUser({ name: 'Ana Souza' })
    const bruno = await seedUser({ name: 'Bruno Lima' })
    await prisma.membership.createMany({
      data: [
        { userId: ana.id, workspaceId: workspace.id, role: 'OWNER' },
        { userId: bruno.id, workspaceId: workspace.id, role: 'MEMBER' },
      ],
    })

    const all = expectOk(await WikiPageRepository.listMembers(workspace.id, ''))
    expect(all.map((m) => m.name)).toEqual(['Ana Souza', 'Bruno Lima'])
    const found = expectOk(
      await WikiPageRepository.listMembers(workspace.id, 'bru'),
    )
    expect(found).toEqual([
      { userId: bruno.id, name: 'Bruno Lima', image: null },
    ])
  })

  it('should return DATABASE_ERROR when the query throws', async () => {
    vi.spyOn(prisma.membership, 'findMany').mockRejectedValueOnce(
      new Error('boom'),
    )
    expectErr(await WikiPageRepository.listMembers('x', ''), 'DATABASE_ERROR')
  })
})
