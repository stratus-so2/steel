import type { EditorDocumentBackend } from '@/components/editor/editor-document-context'
import { useUploadSdKbMedia } from './use-sd-kb-media'
import {
  useCreateSdKbComment,
  useDeleteSdKbComment,
  useResolveSdKbComment,
  useSdKbComments,
  useSdKbMentionableMembers,
  useUpdateSdKbComment,
} from './use-sd-knowledge'

/** ServiceDesk knowledge base: comments refresh by polling (no Yjs). */
export const sdKbEditorBackend: EditorDocumentBackend = {
  useComments: useSdKbComments,
  useCreateComment: useCreateSdKbComment,
  useUpdateComment: useUpdateSdKbComment,
  useResolveComment: useResolveSdKbComment,
  useDeleteComment: useDeleteSdKbComment,
  useMentionableMembers: useSdKbMentionableMembers,
  useUploadMedia: useUploadSdKbMedia,
}
