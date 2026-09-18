import type { ModuleKind } from './workspace-connection'

/** Uso de um módulo somado na janela. */
export interface ModuleUsageTotalDTO {
  module: ModuleKind
  requests: number
  mutations: number
  /** Workspaces distintos que usaram o módulo na janela. */
  workspaces: number
}

/** Ponto da série diária de uso (um por dia × módulo com atividade). */
export interface ModuleUsageDayDTO {
  /** `YYYY-MM-DD` (America/Sao_Paulo). */
  day: string
  module: ModuleKind
  requests: number
  mutations: number
}

export interface TopWorkspaceUsageDTO {
  workspaceId: string
  name: string
  slug: string
  requests: number
  mutations: number
}

/** Cancelamentos de um mês (`YYYY-MM`, America/Sao_Paulo). */
export interface ChurnMonthDTO {
  month: string
  cancelled: number
  expired: number
  /** Receita mensal equivalente perdida, em centavos (BRL). */
  lostMrrCents: number
}

export interface AdminMetricsDTO {
  generatedAt: string
  windowDays: number
  totalWorkspaces: number
  /** Workspaces com uso de módulo registrado na janela. */
  activeClients: number
  /** Workspaces com algum membro com sessão atualizada na janela. */
  workspacesWithLogin: number
  mrr: {
    /** Centavos (BRL); anual entra como valor/12. */
    cents: number
    payingWorkspaces: number
  }
  churnByMonth: ChurnMonthDTO[]
  usage: {
    totals: ModuleUsageTotalDTO[]
    daily: ModuleUsageDayDTO[]
    topWorkspaces: TopWorkspaceUsageDTO[]
    /** Primeiro dia com dado de uso gravado (`null` se ainda não há). */
    trackedSince: string | null
  }
}
