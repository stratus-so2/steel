/** WORKSPACE = shared with every member; PERSONAL = about one user. */
export type AiMemoryScopeDTO = 'WORKSPACE' | 'PERSONAL'

/** AUTO = saved by Steel AI during a chat; MANUAL = added in the tab. */
export type AiMemorySourceDTO = 'AUTO' | 'MANUAL'

/** A fact Steel AI keeps and reads back on every turn. */
export interface AiMemoryDTO {
  id: string
  scope: AiMemoryScopeDTO
  content: string
  source: AiMemorySourceDTO
  /**
   * Conversation the fact came from — only for the user who saved it
   * (conversations are private).
   */
  sourceConversationId: string | null
  /** Last turn whose prompt included this memory. */
  lastUsedAt: string | null
  createdAt: string
  updatedAt: string
  /** May edit or delete (own personal memories; workspace ones for admins). */
  canEdit: boolean
}

/** `GET .../ai/memories`. */
export interface AiMemoryListDTO {
  /** `WorkspaceAiSettings.memoryEnabled`: off = nothing is saved or used. */
  memoryEnabled: boolean
  /** OWNER/ADMIN: may add, edit and delete workspace memories. */
  canManageWorkspace: boolean
  workspace: AiMemoryDTO[]
  personal: AiMemoryDTO[]
}

/** What a memory tool did in a chat turn (the "Memória salva" chip). */
export interface AiMemoryRefDTO {
  id: string
  scope: AiMemoryScopeDTO
  content: string
  /** saved = new fact; duplicate = already known; forgotten = deleted. */
  action: 'saved' | 'duplicate' | 'forgotten'
}
