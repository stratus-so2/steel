import type {
  SdApprovalRoundStatusDTO,
  SdApprovalRoundTallyDTO,
} from '@/types/sd-cab'
import type {
  SdChangeWarningKindDTO,
  SdChangeWindowKindDTO,
} from '@/types/sd-change'

/** Rótulos pt-BR do calendário de mudanças e do comitê (CAB). */

export const SD_WEEK_DAY_LABEL: Record<string, string> = {
  mon: 'Seg',
  tue: 'Ter',
  wed: 'Qua',
  thu: 'Qui',
  fri: 'Sex',
  sat: 'Sáb',
  sun: 'Dom',
}

export function sdWindowKindLabel(kind: SdChangeWindowKindDTO): string {
  return kind === 'FREEZE' ? 'Congelamento' : 'Manutenção'
}

export function sdWarningKindLabel(kind: SdChangeWarningKindDTO): string {
  return kind === 'FREEZE' ? 'Congelamento' : 'Conflito de janela'
}

export const SD_APPROVAL_ROUND_STATUS_LABEL: Record<
  SdApprovalRoundStatusDTO,
  string
> = {
  PENDING: 'Em votação',
  APPROVED: 'Aprovada',
  REJECTED: 'Reprovada',
  CANCELED: 'Cancelada',
  EXPIRED: 'Expirada',
}

export const SD_CHANGE_TYPE_SHORT: Record<string, string> = {
  STANDARD: 'Padrão',
  NORMAL: 'Normal',
  EMERGENCY: 'Emergencial',
}

export const SD_CHANGE_RISK_SHORT: Record<string, string> = {
  LOW: 'Baixo',
  MEDIUM: 'Médio',
  HIGH: 'Alto',
  VERY_HIGH: 'Muito alto',
}

/** "2 de 3 · faltam 1" — o que a tela do chamado mostra do quórum. */
export function sdTallySummary(
  tally: SdApprovalRoundTallyDTO,
  quorum: number,
): string {
  const base = `${tally.approved} de ${quorum} aprovação(ões)`
  if (tally.remaining === 0 && tally.requiredPending === 0) {
    return `${base} · quórum atingido`
  }
  const parts: string[] = []
  if (tally.remaining > 0) parts.push(`faltam ${tally.remaining}`)
  if (tally.requiredPending > 0) {
    parts.push(`${tally.requiredPending} voto(s) obrigatório(s) pendente(s)`)
  }
  return `${base} · ${parts.join(', ')}`
}
