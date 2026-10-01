import type { SdTicketTypeDTO } from './sd-ticket'

export type SdAiModeDTO = 'COPILOT' | 'PRE_SERVICE'

export type SdAiOutcomeDTO = 'resolved_by_kb' | 'ticket_opened' | 'abandoned'

export type SdAiTurnActionDTO =
  | 'answer'
  | 'collect_info'
  | 'resolved'
  | 'open_ticket'

/** Artigo da base sugerido pela IA (cartão no chat). */
export interface SdAiArticleCardDTO {
  id: string
  title: string
  excerpt: string
}

export interface SdAiMessageDTO {
  role: 'user' | 'assistant'
  content: string
  /** ISO 8601. */
  at: string
  /** Artigos citados na resposta do assistente. */
  articles?: SdAiArticleCardDTO[]
}

export interface SdAiConversationDTO {
  id: string
  mode: SdAiModeDTO
  ticketId: string | null
  outcome: SdAiOutcomeDTO | null
  messages: SdAiMessageDTO[]
  createdAt: string
  updatedAt: string
}

/** Rascunho do chamado montado no pré-atendimento. */
export interface SdAiTicketDraftDTO {
  title: string
  description: string
  type: SdTicketTypeDTO
  categoryId: string | null
  subcategoryId: string | null
  serviceId: string | null
  urgencyId: string | null
}

export interface SdAiPreServiceReplyDTO {
  conversation: SdAiConversationDTO
  reply: string
  action: SdAiTurnActionDTO
  articles: SdAiArticleCardDTO[]
  /** Pronto para abrir chamado (ação da IA, palavra de transbordo ou pouca confiança). */
  suggestOpenTicket: boolean
  ticketDraft: SdAiTicketDraftDTO
}

export interface SdAiOpenedTicketDTO {
  id: string
  number: number
  code: string
}

export interface SdAiTextDTO {
  text: string
}

export interface SdAiSuggestionRefDTO {
  id: string
  name: string
}

/** Sugestão de classificação do copiloto (aplicada pela rota de chamados). */
export interface SdAiClassificationDTO {
  category: SdAiSuggestionRefDTO | null
  subcategory: SdAiSuggestionRefDTO | null
  service: SdAiSuggestionRefDTO | null
  impact: SdAiSuggestionRefDTO | null
  urgency: SdAiSuggestionRefDTO | null
  priority: SdAiSuggestionRefDTO | null
  department: SdAiSuggestionRefDTO | null
  tags: string[]
  confidence: number
  reasoning: string
}

/** Conteúdo de `SdTicket.aiTriage` gravado pela triagem automática. */
export interface SdAiTriageRecordDTO {
  suggestions: SdAiClassificationDTO
  /** Campos efetivamente preenchidos (só os que estavam vazios). */
  applied: string[]
  model: string
  at: string
}
