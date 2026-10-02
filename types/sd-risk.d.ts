import type {
  SdNamedRefDTO,
  SdPhaseCategoryDTO,
  SdTicketTypeDTO,
  SdUserSummaryDTO,
} from './sd-ticket'

/** Faixa de risco de violação de SLA (`SdTicketRiskPrediction.level`). */
export type SdRiskLevelDTO = 'LOW' | 'MEDIUM' | 'HIGH'

/**
 * Um fator que pegou neste chamado. `detail` é a frase em pt-BR que a tela
 * mostra: a previsão nunca aparece sem o porquê (ADR 0016).
 */
export interface SdRiskFactorDTO {
  key: string
  label: string
  /** Pontos que o fator somou (1 … peso da tabela). */
  weight: number
  detail: string
}

/** Previsão de risco de um chamado — calculada pelo worker, nunca na tela. */
export interface SdTicketRiskDTO {
  level: SdRiskLevelDTO
  /** 0–100: quanto maior, mais perto de violar. */
  score: number
  factors: SdRiskFactorDTO[]
  /** Quando o prazo estoura se o ritmo atual seguir. */
  breachEtaAt: string | null
  computedAt: string
}

/** Incidente que faz parte de um agrupamento. */
export interface SdClusterTicketRefDTO {
  id: string
  number: number
  /** `INC-000123`. */
  code: string
  title: string
  phase: { name: string; color: string | null; category: SdPhaseCategoryDTO }
  priority: SdNamedRefDTO | null
  createdAt: string
}

export interface SdClusterProblemRefDTO {
  id: string
  number: number
  code: string
  title: string
  type: SdTicketTypeDTO
}

/**
 * Grupo de incidentes parecidos (`SdIncidentCluster`): uma **sugestão** de
 * problema. Abrir o problema (ou descartar) é ação do agente.
 */
export interface SdIncidentClusterDTO {
  id: string
  /** Chave do agrupamento: `categoria:subcategoria:serviço:termos`. */
  signature: string
  title: string
  ticketCount: number
  firstSeenAt: string
  lastSeenAt: string
  /** Os incidentes do grupo (do mais recente para o mais antigo). */
  tickets: SdClusterTicketRefDTO[]
  /** Problema aberto a partir do grupo, quando houve. */
  problemTicket: SdClusterProblemRefDTO | null
  dismissedAt: string | null
  dismissedBy: SdUserSummaryDTO | null
  createdAt: string
  updatedAt: string
}
