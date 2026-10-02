/**
 * Contrato do risco preditivo de violação de SLA.
 *
 * A previsão é uma **heurística explicável**, não um modelo treinado: cada
 * fator soma pontos (0–100) e o chamado cai numa faixa (`LOW`/`MEDIUM`/
 * `HIGH`). O motivo acompanha a nota — a tela mostra "por quê", nunca só o
 * número (ADR 0016).
 *
 * Este arquivo é só a tabela: quais fatores existem, quanto cada um pesa e
 * onde ficam os cortes. Quem calcula é `SdRiskService`; quem desenha é o selo
 * do quadro e a aba do chamado.
 */

import type { SdRiskLevelPrediction } from '@prisma/client'

export const SD_RISK_FACTORS = [
  /** Quanto do prazo de resolução já foi consumido. */
  'sla_consumed',
  /** Chamado sem responsável. */
  'unassigned',
  /** Prioridade/severidade alta. */
  'priority',
  /** Tempo desde a última interação da equipe. */
  'stale',
  /** Já foi reaberto. */
  'reopened',
  /** Fila do departamento acima da média. */
  'queue_pressure',
  /** Aguardando aprovação ou terceiro (o prazo pode não estar pausado). */
  'waiting_third_party',
  /** O responsável tem muitos chamados em risco ao mesmo tempo. */
  'assignee_load',
  /** Histórico: este cliente/serviço já violou prazo antes. */
  'history',
] as const

export type SdRiskFactorKey = (typeof SD_RISK_FACTORS)[number]

export interface SdRiskFactorSpec {
  key: SdRiskFactorKey
  label: string
  /** Peso máximo que o fator pode somar na nota. */
  weight: number
}

/**
 * Pesos somam 100 — o teste garante isso, para a nota continuar sendo
 * legível como porcentagem depois de qualquer ajuste.
 */
export const SD_RISK_FACTOR_SPECS: SdRiskFactorSpec[] = [
  { key: 'sla_consumed', label: 'Prazo já consumido', weight: 30 },
  { key: 'unassigned', label: 'Sem responsável', weight: 12 },
  { key: 'priority', label: 'Prioridade alta', weight: 12 },
  { key: 'stale', label: 'Parado há muito tempo', weight: 12 },
  { key: 'reopened', label: 'Já foi reaberto', weight: 8 },
  { key: 'queue_pressure', label: 'Fila do time cheia', weight: 8 },
  { key: 'waiting_third_party', label: 'Aguardando terceiro', weight: 6 },
  { key: 'assignee_load', label: 'Responsável sobrecarregado', weight: 6 },
  { key: 'history', label: 'Histórico de violação', weight: 6 },
]

/** Nota a partir da qual o chamado entra em cada faixa. */
export const SD_RISK_THRESHOLDS = { medium: 40, high: 70 } as const

const SPEC_BY_KEY = new Map(SD_RISK_FACTOR_SPECS.map((f) => [f.key, f]))

export function sdRiskFactorSpec(key: string): SdRiskFactorSpec | undefined {
  return SPEC_BY_KEY.get(key as SdRiskFactorKey)
}

/** Faixa correspondente à nota (fora de 0–100 cai na borda mais próxima). */
export function sdRiskLevel(score: number): SdRiskLevelPrediction {
  if (score >= SD_RISK_THRESHOLDS.high) return 'HIGH'
  if (score >= SD_RISK_THRESHOLDS.medium) return 'MEDIUM'
  return 'LOW'
}

/** Rótulo da faixa em pt-BR (selo do quadro e aba do chamado). */
export const SD_RISK_LEVEL_LABEL: Record<SdRiskLevelPrediction, string> = {
  LOW: 'Risco baixo',
  MEDIUM: 'Risco médio',
  HIGH: 'Risco alto',
}

/**
 * Cor base Tailwind da faixa, no mesmo padrão dos outros selos do módulo
 * (`bg-<c>-500/10 text-<c>-700 dark:text-<c>-300`).
 */
export const SD_RISK_LEVEL_COLOR: Record<SdRiskLevelPrediction, string> = {
  LOW: 'emerald',
  MEDIUM: 'amber',
  HIGH: 'rose',
}

export interface SdRiskFactorResult {
  key: SdRiskFactorKey
  label: string
  /** Pontos que este fator somou de fato (0 … `weight`). */
  weight: number
  /** Frase curta em pt-BR explicando o fator neste chamado. */
  detail: string
}

/**
 * Soma os fatores numa nota 0–100, sem deixar passar do teto (defensivo: a
 * soma dos pesos é 100, mas um fator duplicado não deve estourar a escala).
 */
export function sdRiskScore(factors: SdRiskFactorResult[]): number {
  const total = factors.reduce((sum, f) => sum + Math.max(0, f.weight), 0)
  return Math.min(100, Math.round(total))
}
