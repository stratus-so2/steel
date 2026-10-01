import type { SdKbArticleDTO, SdKbArticleSummaryDTO } from './sd-kb-article'
import type { SdPhaseCategoryDTO } from './sd-ticket'
import type { SdTicketTypeDTO } from './sd-settings'

/**
 * Portal do contato externo (`/suporte`). Recorte **mínimo** do chamado: o
 * cliente da Stratus não é membro do workspace, então nada de nota interna,
 * custo, peça, aprovação, assinatura, rastreabilidade, SLA, departamento,
 * responsável interno nem plano de mudança — só o andamento do pedido dele.
 */

/** Empresa/cliente a que o contato está vinculado (`SdContactCustomer`). */
export interface SdPortalCustomerDTO {
  id: string
  name: string
  isPrimary: boolean
}

/** Quem está no portal e em qual workspace. */
export interface SdPortalSessionDTO {
  contact: { id: string; name: string; email: string | null }
  workspace: { id: string; name: string; slug: string }
  customers: SdPortalCustomerDTO[]
  /** Fim da sessão de 12 horas (ISO). */
  expiresAt: string
  /** O contato enxerga os chamados das empresas dele, não só os próprios. */
  companyScope: boolean
  /** Tipos que ele pode abrir (`SdSettings.portalTicketTypes`). */
  ticketTypes: SdTicketTypeDTO[]
}

/** Um chamado na lista do portal. */
export interface SdPortalTicketSummaryDTO {
  id: string
  number: number
  /** `INC-000123`. */
  code: string
  type: SdTicketTypeDTO
  title: string
  phase: {
    name: string
    color: string | null
    category: SdPhaseCategoryDTO
  }
  /** % da fase atual (a barra de progresso). */
  completionPercent: number
  /** Empresa do chamado, quando o contato vê os da empresa dele. */
  companyName: string | null
  /** Quem está atendendo (só o primeiro nome do agente). */
  assigneeName: string | null
  /** Encerrado (RESOLVED/CLOSED/CANCELED). */
  closed: boolean
  csatScore: number | null
  lastActivityAt: string
  createdAt: string
}

/** Uma mensagem pública do histórico, vista pelo contato. */
export interface SdPortalMessageDTO {
  id: string
  /** `AGENT` (a equipe), `CONTACT` (ele mesmo), `REQUESTER`, `AI`, `SYSTEM`. */
  authorKind: 'AGENT' | 'REQUESTER' | 'CONTACT' | 'AI' | 'SYSTEM'
  authorName: string
  /** Escrita pelo próprio contato da sessão. */
  mine: boolean
  body: string
  attachments: {
    id: string
    fileName: string
    mimeType: string
    size: number
    /** Rota do portal que serve o arquivo. */
    url: string
  }[]
  createdAt: string
}

/** A tela do chamado no portal. */
export interface SdPortalTicketDetailDTO extends SdPortalTicketSummaryDTO {
  /** HTML já sanitizado da abertura. */
  description: string | null
  /** Categoria › subcategoria › serviço. */
  subject: string | null
  urgencyName: string | null
  /** Texto da solução, quando o chamado foi resolvido. */
  solution: string | null
  resolvedAt: string | null
  closedAt: string | null
  csatComment: string | null
  /** O contato pode responder (chamado não cancelado/fechado). */
  canReply: boolean
  /** O contato pode avaliar (resolvido/fechado e ainda sem nota). */
  canRate: boolean
  messages: SdPortalMessageDTO[]
}

/** Uma opção do formulário de abertura. */
export interface SdPortalOptionDTO {
  id: string
  name: string
}

/** Modelo de chamado oferecido no portal (`SdTicketTemplate.portalVisible`). */
export interface SdPortalTemplateDTO {
  id: string
  name: string
  description: string | null
  ticketType: SdTicketTypeDTO
}

/** Um campo customizado de chamado liberado no portal (`visibleInPortal`). */
export interface SdPortalCustomFieldDTO {
  id: string
  key: string
  label: string
  description: string | null
  type: string
  required: boolean
  options: { value: string; label: string }[]
  ticketTypes: SdTicketTypeDTO[]
  categoryIds: string[]
}

/** Um nó do catálogo visível no portal, já com os filhos. */
export interface SdPortalCatalogNodeDTO extends SdPortalOptionDTO {
  ticketTypes: SdTicketTypeDTO[]
  children: SdPortalCatalogNodeDTO[]
}

/** O que o formulário de abertura precisa, numa chamada só. */
export interface SdPortalFormOptionsDTO {
  ticketTypes: SdTicketTypeDTO[]
  catalog: SdPortalCatalogNodeDTO[]
  templates: SdPortalTemplateDTO[]
  urgencies: SdPortalOptionDTO[]
  customFields: SdPortalCustomFieldDTO[]
}

/** Base de conhecimento publicada no portal. */
export interface SdPortalKbListDTO {
  articles: SdKbArticleSummaryDTO[]
  categories: { id: string; name: string; icon: string | null }[]
}

export type SdPortalKbArticleDTO = SdKbArticleDTO

/** Um link de acesso emitido para um contato (visão do agente). */
export interface SdPortalAccessDTO {
  id: string
  contactId: string
  email: string
  requestedBy: { id: string; name: string } | null
  expiresAt: string
  usedAt: string | null
  sessionExpiresAt: string | null
  revokedAt: string | null
  /** `pending` | `active` | `used` | `expired` | `revoked`. */
  status: 'pending' | 'active' | 'used' | 'expired' | 'revoked'
  createdAt: string
}
