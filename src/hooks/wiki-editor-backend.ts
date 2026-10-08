import type { EditorDocumentBackend } from '@/components/editor/editor-document-context'
import {
  useCreateWikiComment,
  useDeleteWikiComment,
  useResolveWikiComment,
  useUpdateWikiComment,
  useWikiComments,
  wikiCommentsKey,
} from './use-wiki-comment'
import { useUploadWikiMedia } from './use-wiki-media'
import { useWikiMentionableMembers } from './use-wiki-page'

/** Workspace wiki: realtime (Yjs), so peers refresh comments via awareness. */
export const wikiEditorBackend: EditorDocumentBackend = {
  useComments: useWikiComments,
  useCreateComment: useCreateWikiComment,
  useUpdateComment: useUpdateWikiComment,
  useResolveComment: useResolveWikiComment,
  useDeleteComment: useDeleteWikiComment,
  useMentionableMembers: useWikiMentionableMembers,
  useUploadMedia: useUploadWikiMedia,
  commentsQueryKey: wikiCommentsKey,
}
