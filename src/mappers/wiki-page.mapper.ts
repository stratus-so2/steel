import type { Value } from 'platejs'
import type { WikiPageDTO } from '@/types/wiki-page'
import type { WikiPage } from '../repositories/wiki-page.repository'
import { withTimestamps } from './_shared'

export function toWikiPageDTO(wikiPage: WikiPage): WikiPageDTO {
  return {
    id: wikiPage.id,
    workspaceId: wikiPage.workspaceId,
    parentId: wikiPage.parentId,
    title: wikiPage.title,
    icon: wikiPage.icon,
    coverImage: wikiPage.coverImage,
    content: wikiPage.content as Value,
    position: wikiPage.position,
    labelIds: wikiPage.labels.map((label) => label.labelId),
    createdById: wikiPage.createdById,
    updatedById: wikiPage.updatedById,
    archivedAt: wikiPage.archivedAt?.toISOString() ?? null,
    ...withTimestamps(wikiPage),
  }
}
