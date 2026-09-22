import type { Value } from 'platejs'

export interface SdKbCommentAuthorDTO {
  id: string
  name: string
  image: string | null
}

export interface SdKbCommentDTO {
  id: string
  articleId: string
  markId: string
  parentId: string | null
  content: Value
  author: SdKbCommentAuthorDTO | null
  resolved: boolean
  resolvedAt: string | null
  resolvedById: string | null
  createdAt: string
  updatedAt: string
}
