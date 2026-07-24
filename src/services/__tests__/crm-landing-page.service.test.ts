import { describe, expect, it, vi } from 'vitest'
import {
  createFakeCrmLandingPage,
  createFakeCrmLandingPageMessage,
} from '@/src/__tests__/factories/crm-landing-page.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-landing-page.repository')
vi.mock('@/lib/env/server', () => ({
  OPENAI_API_KEY: 'sk-test',
  OPENAI_MODEL: undefined,
  ANTHROPIC_API_KEY: undefined,
  ANTHROPIC_MODEL: undefined,
}))
vi.mock('@/src/lib/ai/client')

import type { AiStreamEvent } from '@/src/lib/ai/client'
import { streamChat } from '@/src/lib/ai/client'
import {
  CrmLandingPageMessageRepository,
  CrmLandingPageRepository,
  CrmLandingPageViewRepository,
} from '@/src/repositories/crm-landing-page.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { CrmLandingPageService } from '../crm-landing-page.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedPageRepo = vi.mocked(CrmLandingPageRepository)
const mockedViewRepo = vi.mocked(CrmLandingPageViewRepository)
const mockedMessageRepo = vi.mocked(CrmLandingPageMessageRepository)
const mockedStreamChat = vi.mocked(streamChat)

async function* fakeStream(
  events: AiStreamEvent[],
): AsyncGenerator<AiStreamEvent, void, unknown> {
  for (const ev of events) yield ev
}

describe('CrmLandingPageService', () => {
  describe('list()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(await CrmLandingPageService.list('u1', 'ws1'), 'FORBIDDEN')
    })
  })

  describe('update()', () => {
    it('should stamp publishedAt on the first publish', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok({ id: 'm1' } as never),
      )
      const existing = createFakeCrmLandingPage({
        id: 'p1',
        status: 'DRAFT',
        publishedAt: null,
      })
      mockedPageRepo.findById.mockResolvedValue(ok(existing))
      mockedPageRepo.update.mockResolvedValue(
        ok({ ...existing, status: 'PUBLISHED', publishedAt: new Date() }),
      )

      expectOk(
        await CrmLandingPageService.update('u1', 'ws1', 'p1', {
          status: 'PUBLISHED',
        }),
      )
      expect(mockedPageRepo.update).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({
          status: 'PUBLISHED',
          publishedAt: expect.any(Date),
        }),
      )
    })

    it('should not overwrite publishedAt when re-publishing', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok({ id: 'm1' } as never),
      )
      const originalPublishedAt = new Date('2026-01-01T00:00:00Z')
      const existing = createFakeCrmLandingPage({
        id: 'p1',
        status: 'DRAFT',
        publishedAt: originalPublishedAt,
      })
      mockedPageRepo.findById.mockResolvedValue(ok(existing))
      mockedPageRepo.update.mockResolvedValue(ok(existing))

      expectOk(
        await CrmLandingPageService.update('u1', 'ws1', 'p1', {
          status: 'PUBLISHED',
        }),
      )
      expect(mockedPageRepo.update).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ publishedAt: undefined }),
      )
    })
  })

  describe('listViews()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(
        await CrmLandingPageService.listViews('u1', 'ws1', 'p1'),
        'FORBIDDEN',
      )
    })
  })

  describe('getPublicByShareToken()', () => {
    it('should return only title and html without auth', async () => {
      mockedPageRepo.findByShareToken.mockResolvedValue(
        ok(
          createFakeCrmLandingPage({
            title: 'Home',
            html: '<p>Oi</p>',
            shareToken: 'tok',
          }),
        ),
      )

      const dto = expectOk(
        await CrmLandingPageService.getPublicByShareToken('tok'),
      )
      expect(dto).toEqual({ title: 'Home', html: '<p>Oi</p>' })
      expect(dto).not.toHaveProperty('shareToken')
    })
  })

  describe('recordView()', () => {
    it('should hash the ip before recording', async () => {
      mockedPageRepo.findByShareToken.mockResolvedValue(
        ok(createFakeCrmLandingPage({ id: 'p1', shareToken: 'tok' })),
      )
      mockedViewRepo.record.mockResolvedValue(
        ok({
          id: 'v1',
          landingPageId: 'p1',
          viewId: 'view1',
          ipHash: 'hashed',
          durationMs: 0,
          ctaClicks: 0,
          referrer: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      )

      expectOk(
        await CrmLandingPageService.recordView('tok', '1.2.3.4', {
          viewId: 'view1',
          durationMs: 0,
          ctaClicks: 0,
        }),
      )
      expect(mockedViewRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          ipHash: expect.not.stringContaining('1.2.3.4'),
        }),
      )
    })
  })

  describe('listMessages()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(
        await CrmLandingPageService.listMessages('u1', 'ws1', 'p1'),
        'FORBIDDEN',
      )
    })

    it('should list messages mapped to DTOs', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok({ id: 'm1' } as never),
      )
      mockedPageRepo.findById.mockResolvedValue(
        ok(createFakeCrmLandingPage({ id: 'p1' })),
      )
      mockedMessageRepo.listByLandingPage.mockResolvedValue(
        ok([createFakeCrmLandingPageMessage({ id: 'msg1', role: 'USER' })]),
      )

      const list = expectOk(
        await CrmLandingPageService.listMessages('u1', 'ws1', 'p1'),
      )
      expect(list).toEqual([
        expect.objectContaining({ id: 'msg1', role: 'user' }),
      ])
    })
  })

  describe('generate()', () => {
    it('should persist the user message, call streamChat and save the generated html', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok({ id: 'm1' } as never),
      )
      const page = createFakeCrmLandingPage({ id: 'p1', html: '' })
      mockedPageRepo.findById.mockResolvedValue(ok(page))
      mockedMessageRepo.append.mockImplementation(async (data) =>
        ok(
          createFakeCrmLandingPageMessage({
            id: `msg-${data.role}`,
            role: data.role,
            content: data.content,
          }),
        ),
      )
      mockedPageRepo.update.mockResolvedValue(ok(page))

      mockedStreamChat.mockReturnValue(
        fakeStream([
          { type: 'text', delta: '' },
          {
            type: 'finish',
            finishReason: 'tool_calls',
            content: '',
            usage: null,
            toolCalls: [
              {
                id: 'call1',
                name: 'render_landing_page',
                args: JSON.stringify({
                  summary: 'Página criada',
                  html: '<!DOCTYPE html><html><body>Oi</body></html>',
                }),
              },
            ],
          },
        ]),
      )

      const result = expectOk(
        await CrmLandingPageService.generate({
          actorId: 'u1',
          workspaceId: 'ws1',
          pageId: 'p1',
          message: 'Crie uma landing page',
        }),
      )

      const chunks: unknown[] = []
      for await (const chunk of result.run) chunks.push(chunk)

      expect(chunks[0]).toEqual(expect.objectContaining({ type: 'user' }))
      expect(chunks.at(-1)).toEqual(
        expect.objectContaining({
          type: 'done',
          html: '<!DOCTYPE html><html><body>Oi</body></html>',
        }),
      )
      expect(mockedPageRepo.update).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({
          html: '<!DOCTYPE html><html><body>Oi</body></html>',
        }),
      )
      expect(mockedMessageRepo.append).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'USER',
          content: 'Crie uma landing page',
        }),
      )
      expect(mockedMessageRepo.append).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'ASSISTANT',
          content: 'Página criada',
        }),
      )
    })

    it('should yield an error chunk when the model returns no html', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok({ id: 'm1' } as never),
      )
      const page = createFakeCrmLandingPage({ id: 'p1', html: '' })
      mockedPageRepo.findById.mockResolvedValue(ok(page))
      mockedMessageRepo.append.mockResolvedValue(
        ok(createFakeCrmLandingPageMessage({ id: 'msg1', role: 'USER' })),
      )

      mockedStreamChat.mockReturnValue(
        fakeStream([
          {
            type: 'finish',
            finishReason: 'stop',
            content: '',
            usage: null,
            toolCalls: [],
          },
        ]),
      )

      const result = expectOk(
        await CrmLandingPageService.generate({
          actorId: 'u1',
          workspaceId: 'ws1',
          pageId: 'p1',
          message: 'Crie uma landing page',
        }),
      )

      const chunks: unknown[] = []
      for await (const chunk of result.run) chunks.push(chunk)

      expect(chunks.at(-1)).toEqual(expect.objectContaining({ type: 'error' }))
      expect(mockedPageRepo.update).not.toHaveBeenCalled()
    })
  })
})
