import { describe, expect, it, vi } from 'vitest'
import {
  seedSdKbArticle,
  seedSdKbComment,
} from '@/src/__tests__/factories/sd-kb.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { SdKbCommentRepository } from '../sd-kb-comment.repository'

async function setup() {
  const [ws, user] = await Promise.all([seedWorkspace(), seedUser()])
  const article = await seedSdKbArticle(ws.id)
  return { ws, user, article }
}

const content = [{ type: 'p', children: [{ text: 'Olá' }] }]

describe('SdKbCommentRepository', () => {
  it('creates, finds and lists comments with the author, ordered by mark/date', async () => {
    const { user, article } = await setup()
    const created = expectOk(
      await SdKbCommentRepository.create({
        articleId: article.id,
        authorId: user.id,
        markId: 'b',
        content,
      }),
    )
    expect(created.author).toMatchObject({ id: user.id, name: user.name })
    await seedSdKbComment(article.id, user.id, { markId: 'a' })

    expect(expectOk(await SdKbCommentRepository.findById(created.id)).id).toBe(
      created.id,
    )
    const list = expectOk(await SdKbCommentRepository.listByArticle(article.id))
    expect(list.map((c) => c.markId)).toEqual(['a', 'b'])
  })

  it('returns SD_KB_COMMENT_NOT_FOUND for a missing comment', async () => {
    expectErr(
      await SdKbCommentRepository.findById('missing'),
      'SD_KB_COMMENT_NOT_FOUND',
    )
    expectErr(
      await SdKbCommentRepository.update('missing', content),
      'SD_KB_COMMENT_NOT_FOUND',
    )
    expectErr(
      await SdKbCommentRepository.resolve('missing', {
        resolved: true,
        resolvedById: null,
      }),
      'SD_KB_COMMENT_NOT_FOUND',
    )
    expectErr(
      await SdKbCommentRepository.delete('missing'),
      'SD_KB_COMMENT_NOT_FOUND',
    )
  })

  it('updates, resolves, reopens and deletes', async () => {
    const { user, article } = await setup()
    const seeded = await seedSdKbComment(article.id, user.id)

    const updated = expectOk(
      await SdKbCommentRepository.update(seeded.id, content),
    )
    expect(updated.content).toEqual(content)

    const resolved = expectOk(
      await SdKbCommentRepository.resolve(seeded.id, {
        resolved: true,
        resolvedById: user.id,
      }),
    )
    expect(resolved).toMatchObject({ resolved: true, resolvedById: user.id })
    expect(resolved.resolvedAt).toBeInstanceOf(Date)

    const reopened = expectOk(
      await SdKbCommentRepository.resolve(seeded.id, {
        resolved: false,
        resolvedById: user.id,
      }),
    )
    expect(reopened).toMatchObject({
      resolved: false,
      resolvedById: null,
      resolvedAt: null,
    })

    expectOk(await SdKbCommentRepository.delete(seeded.id))
    expect(await prisma.sdKbComment.count()).toBe(0)
  })

  it('maps other Prisma failures to DATABASE_ERROR', async () => {
    const boom = () => Promise.reject(new Error('boom'))
    const spies = [
      vi
        .spyOn(prisma.sdKbComment, 'findUnique')
        .mockImplementation(boom as never),
      vi
        .spyOn(prisma.sdKbComment, 'findMany')
        .mockImplementation(boom as never),
      vi.spyOn(prisma.sdKbComment, 'create').mockImplementation(boom as never),
      vi.spyOn(prisma.sdKbComment, 'update').mockImplementation(boom as never),
      vi.spyOn(prisma.sdKbComment, 'delete').mockImplementation(boom as never),
    ]
    expectErr(await SdKbCommentRepository.findById('c'), 'DATABASE_ERROR')
    expectErr(await SdKbCommentRepository.listByArticle('a'), 'DATABASE_ERROR')
    expectErr(
      await SdKbCommentRepository.create({
        articleId: 'a',
        authorId: 'u',
        markId: 'm',
        content,
      }),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdKbCommentRepository.update('c', content),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdKbCommentRepository.resolve('c', {
        resolved: true,
        resolvedById: 'u',
      }),
      'DATABASE_ERROR',
    )
    expectErr(await SdKbCommentRepository.delete('c'), 'DATABASE_ERROR')
    for (const spy of spies) spy.mockRestore()
  })
})
