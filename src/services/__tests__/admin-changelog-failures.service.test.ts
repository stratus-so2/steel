import { describe, expect, it, vi } from 'vitest'
import { createFakeChangelogWithDetails } from '@/src/__tests__/factories/changelog.factory'
import { createFakeUser } from '@/src/__tests__/factories/user.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import type { AppError } from '@/src/errors/app-error'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/changelog.repository')
vi.mock('@/src/repositories/user.repository')
vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))

const { addBulk } = vi.hoisted(() => ({
  addBulk: vi.fn(async (_jobs: unknown[]) => []),
}))
vi.mock('@/src/lib/queue/queues', () => ({
  getChangelogQueue: vi.fn(() => ({ addBulk })),
}))

import { auditMutation } from '@/lib/axiom/audit'
import { ChangelogRepository } from '@/src/repositories/changelog.repository'
import { UserRepository } from '@/src/repositories/user.repository'
import { AdminChangelogService } from '../admin-changelog.service'

const mockedChangelogRepo = vi.mocked(ChangelogRepository)
const mockedUserRepo = vi.mocked(UserRepository)

const DB_ERROR: AppError = { code: 'DATABASE_ERROR', message: 'db down' }

const platformAdmin = createFakeUser({
  id: 'admin1',
  isPlatformAdmin: true,
  email: 'admin@stratustelecom.com.br',
})

function asPlatformAdmin() {
  mockedUserRepo.findById.mockResolvedValue(ok(platformAdmin))
}

function asRegularUser() {
  mockedUserRepo.findById.mockResolvedValue(
    ok(createFakeUser({ isPlatformAdmin: false })),
  )
}

describe('AdminChangelogService.searchUsers()', () => {
  it('should deny a non-platform-admin actor', async () => {
    asRegularUser()

    expectErr(await AdminChangelogService.searchUsers('u1', 'ana'), 'FORBIDDEN')
    expect(mockedUserRepo.search).not.toHaveBeenCalled()
  })

  it('should return nothing for queries shorter than two characters', async () => {
    asPlatformAdmin()

    expect(
      expectOk(await AdminChangelogService.searchUsers('admin1', '  a  ')),
    ).toEqual([])
    expect(mockedUserRepo.search).not.toHaveBeenCalled()
  })

  it('should search by the trimmed query and map the users', async () => {
    asPlatformAdmin()
    mockedUserRepo.search.mockResolvedValue(
      ok([createFakeUser({ id: 'u2', name: 'Ana', email: 'ana@example.com' })]),
    )

    const results = expectOk(
      await AdminChangelogService.searchUsers('admin1', '  ana '),
    )

    expect(mockedUserRepo.search).toHaveBeenCalledWith('ana')
    expect(results).toEqual([
      expect.objectContaining({ id: 'u2', email: 'ana@example.com' }),
    ])
  })

  it('should propagate a search failure', async () => {
    asPlatformAdmin()
    mockedUserRepo.search.mockResolvedValue(err(DB_ERROR))

    expectErr(
      await AdminChangelogService.searchUsers('admin1', 'ana'),
      'DATABASE_ERROR',
    )
  })
})

describe('AdminChangelogService reads', () => {
  it('list() should propagate a repository failure', async () => {
    asPlatformAdmin()
    mockedChangelogRepo.list.mockResolvedValue(err(DB_ERROR))

    expectErr(await AdminChangelogService.list('admin1'), 'DATABASE_ERROR')
  })

  it('getById() should deny a non-platform-admin actor', async () => {
    asRegularUser()

    expectErr(await AdminChangelogService.getById('u1', 'c1'), 'FORBIDDEN')
  })

  it('getById() should return the changelog detail', async () => {
    asPlatformAdmin()
    mockedChangelogRepo.findById.mockResolvedValue(
      ok(createFakeChangelogWithDetails({ id: 'c1', subject: 'Setembro' })),
    )

    const detail = expectOk(await AdminChangelogService.getById('admin1', 'c1'))

    expect(detail).toEqual(
      expect.objectContaining({ id: 'c1', subject: 'Setembro' }),
    )
  })

  it('getById() should propagate a repository failure', async () => {
    asPlatformAdmin()
    mockedChangelogRepo.findById.mockResolvedValue(err(DB_ERROR))

    expectErr(
      await AdminChangelogService.getById('admin1', 'c1'),
      'DATABASE_ERROR',
    )
  })

  it('getById() should return CHANGELOG_NOT_FOUND when missing', async () => {
    asPlatformAdmin()
    mockedChangelogRepo.findById.mockResolvedValue(ok(null))

    expectErr(
      await AdminChangelogService.getById('admin1', 'c1'),
      'CHANGELOG_NOT_FOUND',
    )
  })
})

describe('AdminChangelogService.create() failures', () => {
  const dto = {
    subject: 'Novidades',
    items: [{ title: 'Item', body: 'Corpo' }],
    userIds: ['u1'],
    emails: [],
  }

  it('should propagate a failure resolving the selected users', async () => {
    asPlatformAdmin()
    mockedUserRepo.findManyByIds.mockResolvedValue(err(DB_ERROR))

    expectErr(
      await AdminChangelogService.create('admin1', dto),
      'DATABASE_ERROR',
    )
    expect(mockedChangelogRepo.create).not.toHaveBeenCalled()
  })

  it('should audit and propagate a create failure', async () => {
    asPlatformAdmin()
    mockedUserRepo.findManyByIds.mockResolvedValue(
      ok([createFakeUser({ id: 'u1', email: 'A@Example.com' })]),
    )
    mockedChangelogRepo.create.mockResolvedValue(err(DB_ERROR))

    expectErr(
      await AdminChangelogService.create('admin1', dto),
      'DATABASE_ERROR',
    )
    expect(mockedChangelogRepo.create).toHaveBeenCalledWith(
      { subject: 'Novidades', createdById: 'admin1' },
      dto.items,
      [{ email: 'a@example.com', userId: 'u1' }],
    )
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'changelog',
        outcome: 'failure',
        reason: 'DATABASE_ERROR',
      }),
    )
  })
})

describe('AdminChangelogService.start() failures', () => {
  const draft = () => createFakeChangelogWithDetails({ id: 'c1' })

  it('should deny a non-platform-admin actor', async () => {
    asRegularUser()

    expectErr(await AdminChangelogService.start('u1', 'c1'), 'FORBIDDEN')
  })

  it('should propagate a lookup failure', async () => {
    asPlatformAdmin()
    mockedChangelogRepo.findById.mockResolvedValue(err(DB_ERROR))

    expectErr(
      await AdminChangelogService.start('admin1', 'c1'),
      'DATABASE_ERROR',
    )
  })

  it('should return CHANGELOG_NOT_FOUND when missing', async () => {
    asPlatformAdmin()
    mockedChangelogRepo.findById.mockResolvedValue(ok(null))

    expectErr(
      await AdminChangelogService.start('admin1', 'c1'),
      'CHANGELOG_NOT_FOUND',
    )
    expect(addBulk).not.toHaveBeenCalled()
  })

  it('should propagate a status update failure', async () => {
    asPlatformAdmin()
    mockedChangelogRepo.findById.mockResolvedValue(ok(draft()))
    mockedChangelogRepo.updateStatus.mockResolvedValue(err(DB_ERROR))

    expectErr(
      await AdminChangelogService.start('admin1', 'c1'),
      'DATABASE_ERROR',
    )
    expect(auditMutation).not.toHaveBeenCalled()
  })

  it('should propagate a failure reloading the started changelog', async () => {
    asPlatformAdmin()
    mockedChangelogRepo.findById
      .mockResolvedValueOnce(ok(draft()))
      .mockResolvedValueOnce(err(DB_ERROR))
    mockedChangelogRepo.updateStatus.mockResolvedValue(ok(draft()))

    expectErr(
      await AdminChangelogService.start('admin1', 'c1'),
      'DATABASE_ERROR',
    )
  })

  it('should return CHANGELOG_NOT_FOUND when the reload finds nothing', async () => {
    asPlatformAdmin()
    mockedChangelogRepo.findById
      .mockResolvedValueOnce(ok(draft()))
      .mockResolvedValueOnce(ok(null))
    mockedChangelogRepo.updateStatus.mockResolvedValue(ok(draft()))

    expectErr(
      await AdminChangelogService.start('admin1', 'c1'),
      'CHANGELOG_NOT_FOUND',
    )
  })
})
