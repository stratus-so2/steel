import type {
  SdKbArticleDTO,
  SdKbArticleSummaryDTO,
} from '@/types/sd-kb-article'

export const WS = 'ws-1'

export function summary(
  overrides: Partial<SdKbArticleSummaryDTO> = {},
): SdKbArticleSummaryDTO {
  return {
    id: 'a1',
    workspaceId: WS,
    parentId: null,
    title: 'VPN corporativa',
    icon: null,
    coverImage: null,
    status: 'PUBLISHED',
    visibility: 'PORTAL',
    categoryId: null,
    tags: [],
    position: 0,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
    publishedAt: '2026-09-01T00:00:00.000Z',
    archivedAt: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-10T00:00:00.000Z',
    ...overrides,
  }
}

export function article(
  overrides: Partial<SdKbArticleDTO> = {},
): SdKbArticleDTO {
  return {
    ...summary(),
    content: [
      { type: 'h2', children: [{ text: 'Passo 1' }] },
      { type: 'p', children: [{ text: 'Reinicie o cliente' }] },
    ],
    readingMinutes: 1,
    createdById: 'u1',
    updatedById: 'u1',
    createdBy: { id: 'u1', name: 'Ana', image: null },
    updatedBy: { id: 'u1', name: 'Ana', image: null },
    category: null,
    myVote: null,
    ...overrides,
  }
}
