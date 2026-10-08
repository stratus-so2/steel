import type { WikiLabel } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError, forbidden, wikiLabelConflict } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WikiLabelRepository } from '@/src/repositories/wiki-label.repository'
import { WikiLabelService } from '../wiki-label.service'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/wiki-label.repository')
vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))

const mockedMembership = vi.mocked(MembershipRepository)
const mockedLabels = vi.mocked(WikiLabelRepository)

function label(overrides: Partial<WikiLabel> = {}): WikiLabel {
  const now = new Date()
  return {
    id: 'label-1',
    workspaceId: 'ws1',
    name: 'RH',
    color: 'green',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function asRole(role: 'OWNER' | 'MEMBER') {
  mockedMembership.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ userId: 'actor', workspaceId: 'ws1', role })),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  asRole('OWNER')
})

describe('WikiLabelService.list()', () => {
  it('should return the labels with their page counts to any member', async () => {
    asRole('MEMBER')
    mockedLabels.listByWorkspace.mockResolvedValue(
      ok([{ ...label(), pageCount: 3 }]),
    )

    const labels = expectOk(await WikiLabelService.list('actor', 'ws1'))

    expect(labels).toEqual([
      expect.objectContaining({ name: 'RH', color: 'green', pageCount: 3 }),
    ])
  })

  it('should return FORBIDDEN for a non-member', async () => {
    mockedMembership.findByUserAndWorkspace.mockResolvedValue(err(forbidden()))

    expectErr(await WikiLabelService.list('actor', 'ws1'), 'FORBIDDEN')
  })

  it('should propagate the repository error', async () => {
    mockedLabels.listByWorkspace.mockResolvedValue(err(databaseError('x')))

    expectErr(await WikiLabelService.list('actor', 'ws1'), 'DATABASE_ERROR')
  })
})

describe('WikiLabelService.create()', () => {
  it('should create a label for an owner', async () => {
    mockedLabels.create.mockResolvedValue(ok(label()))

    const created = expectOk(
      await WikiLabelService.create('actor', 'ws1', {
        name: 'RH',
        color: 'green',
      }),
    )

    expect(created.pageCount).toBe(0)
    expect(mockedLabels.create).toHaveBeenCalledWith({
      workspaceId: 'ws1',
      name: 'RH',
      color: 'green',
    })
  })

  it('should return FORBIDDEN for a plain member', async () => {
    asRole('MEMBER')

    expectErr(
      await WikiLabelService.create('actor', 'ws1', {
        name: 'RH',
        color: 'green',
      }),
      'FORBIDDEN',
    )
    expect(mockedLabels.create).not.toHaveBeenCalled()
  })

  it('should propagate a duplicate name', async () => {
    mockedLabels.create.mockResolvedValue(err(wikiLabelConflict()))

    expectErr(
      await WikiLabelService.create('actor', 'ws1', {
        name: 'RH',
        color: 'green',
      }),
      'WIKI_LABEL_CONFLICT',
    )
  })
})

describe('WikiLabelService.update()', () => {
  it('should rename a label of the workspace', async () => {
    mockedLabels.findById.mockResolvedValue(ok(label()))
    mockedLabels.update.mockResolvedValue(ok(label({ name: 'Pessoas' })))

    const updated = expectOk(
      await WikiLabelService.update('actor', 'ws1', 'label-1', {
        name: 'Pessoas',
      }),
    )

    expect(updated.name).toBe('Pessoas')
  })

  it('should hide a label of another workspace', async () => {
    mockedLabels.findById.mockResolvedValue(ok(label({ workspaceId: 'ws2' })))

    expectErr(
      await WikiLabelService.update('actor', 'ws1', 'label-1', { name: 'x' }),
      'WIKI_LABEL_NOT_FOUND',
    )
    expect(mockedLabels.update).not.toHaveBeenCalled()
  })

  it('should return FORBIDDEN for a plain member', async () => {
    asRole('MEMBER')

    expectErr(
      await WikiLabelService.update('actor', 'ws1', 'label-1', { name: 'x' }),
      'FORBIDDEN',
    )
  })

  it('should propagate a lookup failure', async () => {
    mockedLabels.findById.mockResolvedValue(err(databaseError('x')))

    expectErr(
      await WikiLabelService.update('actor', 'ws1', 'label-1', { name: 'x' }),
      'DATABASE_ERROR',
    )
  })

  it('should propagate an update failure', async () => {
    mockedLabels.findById.mockResolvedValue(ok(label()))
    mockedLabels.update.mockResolvedValue(err(wikiLabelConflict()))

    expectErr(
      await WikiLabelService.update('actor', 'ws1', 'label-1', { name: 'x' }),
      'WIKI_LABEL_CONFLICT',
    )
  })
})

describe('WikiLabelService.delete()', () => {
  it('should delete a label of the workspace', async () => {
    mockedLabels.findById.mockResolvedValue(ok(label()))
    mockedLabels.delete.mockResolvedValue(ok(undefined))

    expectOk(await WikiLabelService.delete('actor', 'ws1', 'label-1'))
    expect(mockedLabels.delete).toHaveBeenCalledWith('label-1')
  })

  it('should return FORBIDDEN for a plain member', async () => {
    asRole('MEMBER')

    expectErr(
      await WikiLabelService.delete('actor', 'ws1', 'label-1'),
      'FORBIDDEN',
    )
  })

  it('should hide a label of another workspace', async () => {
    mockedLabels.findById.mockResolvedValue(ok(label({ workspaceId: 'ws2' })))

    expectErr(
      await WikiLabelService.delete('actor', 'ws1', 'label-1'),
      'WIKI_LABEL_NOT_FOUND',
    )
  })

  it('should propagate a delete failure', async () => {
    mockedLabels.findById.mockResolvedValue(ok(label()))
    mockedLabels.delete.mockResolvedValue(err(databaseError('x')))

    expectErr(
      await WikiLabelService.delete('actor', 'ws1', 'label-1'),
      'DATABASE_ERROR',
    )
  })
})
