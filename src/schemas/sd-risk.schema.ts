import z from 'zod'
import { sdId } from './sd-config.schema'

/**
 * Contrato da API de risco preditivo
 * (`/api/workspaces/[id]/servicedesk/risk/**`). A nota e os fatores **não
 * entram por aqui**: são calculados pelo worker (`servicedesk-risk`,
 * heurística explicável — ADR 0016). O que o cliente informa é só o recorte
 * da leitura e os dados do problema aberto a partir de um agrupamento.
 */

export const SD_RISK_LEVEL_PREDICTIONS = ['LOW', 'MEDIUM', 'HIGH'] as const
export const SdRiskLevelPredictionEnum = z.enum(SD_RISK_LEVEL_PREDICTIONS)

function blank(value: unknown): unknown {
  return value === '' || value === null ? undefined : value
}

export const ListSdRiskTicketsSchema = z.object({
  /** Faixa exata (padrão: `HIGH`, que é a fila que interessa). */
  level: z.preprocess(blank, SdRiskLevelPredictionEnum.default('HIGH')),
  /** Nota mínima — refina a faixa quando a fila é grande. */
  minScore: z.preprocess(
    blank,
    z.coerce.number().int().min(0).max(100).optional(),
  ),
  departmentId: z.preprocess(blank, sdId.optional()),
  assigneeId: z.preprocess(blank, sdId.optional()),
  limit: z.preprocess(
    blank,
    z.coerce.number().int().min(1).max(200).default(50),
  ),
})
export type ListSdRiskTicketsDTO = z.infer<typeof ListSdRiskTicketsSchema>

export const SD_CLUSTER_STATUSES = ['open', 'handled', 'all'] as const

export const ListSdIncidentClustersSchema = z.object({
  /**
   * `open` = sugestões vivas (sem problema aberto e sem descarte);
   * `handled` = já viraram problema ou foram descartadas.
   */
  status: z.preprocess(blank, z.enum(SD_CLUSTER_STATUSES).default('open')),
  limit: z.preprocess(
    blank,
    z.coerce.number().int().min(1).max(100).default(30),
  ),
})
export type ListSdIncidentClustersDTO = z.infer<
  typeof ListSdIncidentClustersSchema
>

/**
 * Abertura do problema a partir do agrupamento — é sempre ação humana
 * (ADR 0016). Tudo é opcional: sem nada informado, o título do grupo e o
 * motor do chamado (roteamento, SLA, fase inicial) decidem o resto.
 */
export const OpenSdClusterProblemSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  departmentId: sdId.optional(),
  assigneeId: sdId.optional(),
  priorityId: sdId.optional(),
  categoryId: sdId.optional(),
  /** Vincula os incidentes do grupo como filhos (padrão: vincula). */
  linkIncidents: z.boolean().default(true),
})
export type OpenSdClusterProblemDTO = z.infer<typeof OpenSdClusterProblemSchema>
