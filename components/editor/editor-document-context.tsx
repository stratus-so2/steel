'use client'

import type {
  QueryKey,
  UseMutationResult,
  UseQueryResult,
} from '@tanstack/react-query'
import type { Value } from 'platejs'
import * as React from 'react'

/**
 * Which document the shared Plate editor is editing, and how it talks to that
 * document's API. The comment, mention and media nodes only read this
 * context, so the ServiceDesk knowledge base and the workspace wiki reuse the
 * same UI: each one hands in its own `backend` (a fixed object of hooks).
 */

export interface EditorCommentAuthor {
  id: string
  name: string
  image: string | null
}

export interface EditorComment {
  id: string
  markId: string
  parentId: string | null
  content: Value
  author: EditorCommentAuthor | null
  resolved: boolean
  createdAt: string
  updatedAt: string
}

export interface EditorMentionableMember {
  userId: string
  name: string
  image: string | null
}

export interface EditorUploadedMedia {
  key: string
  url: string
  name: string
}

export interface EditorMediaUpload {
  isUploading: boolean
  progress: number
  uploadedFile: EditorUploadedMedia | undefined
  uploadingFile: File | undefined
  uploadFile: (file: File) => Promise<EditorUploadedMedia>
}

type Mutation<TInput> = UseMutationResult<unknown, Error, TInput>

export interface EditorDocumentBackend {
  useComments(
    workspaceId: string,
    documentId: string,
  ): UseQueryResult<EditorComment[]>
  useCreateComment(
    workspaceId: string,
    documentId: string,
  ): Mutation<{ markId: string; content: Value; parentId?: string }>
  useUpdateComment(
    workspaceId: string,
    documentId: string,
  ): Mutation<{ commentId: string; content: Value }>
  useResolveComment(
    workspaceId: string,
    documentId: string,
  ): Mutation<{ commentId: string; resolved: boolean }>
  useDeleteComment(workspaceId: string, documentId: string): Mutation<string>
  useMentionableMembers(
    workspaceId: string,
    search: string,
  ): UseQueryResult<EditorMentionableMember[]>
  /** Reads the document from this context; see `useEditorDocument`. */
  useUploadMedia(): EditorMediaUpload
  /**
   * Set only by realtime documents (Yjs): the comments query that peers
   * invalidate when someone else changes a thread.
   */
  commentsQueryKey?: (workspaceId: string, documentId: string) => QueryKey
}

export interface EditorDocumentContextValue {
  workspaceId: string
  documentId: string
  userId: string
  userName: string
  backend: EditorDocumentBackend
}

const EditorDocumentContext =
  React.createContext<EditorDocumentContextValue | null>(null)

export function EditorDocumentProvider({
  workspaceId,
  documentId,
  userId,
  userName,
  backend,
  children,
}: React.PropsWithChildren<EditorDocumentContextValue>) {
  const value = React.useMemo(
    () => ({ workspaceId, documentId, userId, userName, backend }),
    [workspaceId, documentId, userId, userName, backend],
  )
  return (
    <EditorDocumentContext.Provider value={value}>
      {children}
    </EditorDocumentContext.Provider>
  )
}

export function useEditorDocument(): EditorDocumentContextValue {
  const ctx = React.useContext(EditorDocumentContext)
  if (!ctx) {
    throw new Error(
      'useEditorDocument deve ser usado dentro de EditorDocumentProvider',
    )
  }
  return ctx
}
