import type { CrmLeadStageDTO } from '@/types/crm-lead'

/** As 6 etapas fixas do painel de leads — ver CrmLeadService para as regras
 * de avanço (gates) entre cada uma. */
export const LEAD_STAGES: CrmLeadStageDTO[] = [
  'RECEIVED',
  'IN_CONTACT',
  'QUALIFIED',
  'OPPORTUNITY',
  'PROPOSAL',
  'CLOSED',
]

export const STAGE_STYLES: Record<CrmLeadStageDTO, string> = {
  RECEIVED: 'bg-blue-500/15 text-blue-600',
  IN_CONTACT: 'bg-amber-500/15 text-amber-600',
  QUALIFIED: 'bg-emerald-500/15 text-emerald-600',
  OPPORTUNITY: 'bg-violet-500/15 text-violet-600',
  PROPOSAL: 'bg-orange-500/15 text-orange-600',
  CLOSED: 'bg-rose-500/15 text-rose-600',
}

export const STAGE_LABELS: Record<CrmLeadStageDTO, string> = {
  RECEIVED: 'Lead recebido',
  IN_CONTACT: 'Em contato',
  QUALIFIED: 'Lead qualificado',
  OPPORTUNITY: 'Interesse/Oportunidade',
  PROPOSAL: 'Proposta',
  CLOSED: 'Fechado/Encerrado',
}
