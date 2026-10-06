import {
  emitNotification,
  workspaceAdminIds,
  workspaceOwnerIds,
} from './notification-emitter'

/**
 * In-app notifications of the platform/base ("Plataforma" in the inbox).
 * Same contract as `crm-notifications.ts`: pt-BR copy, internal links, and
 * fire-and-forget delivery that never fails the caller.
 */

const BILLING_PATH = '/settings/billing'

export function notifyMemberJoined(input: {
  workspaceId: string
  inviterId: string
  memberId: string
  memberEmail: string
}): Promise<number> {
  return emitNotification({
    workspaceId: input.workspaceId,
    recipients: [input.inviterId],
    actorId: input.memberId,
    kind: 'MEMBER_JOINED',
    title: 'Convite aceito',
    body: `${input.memberEmail} aceitou o seu convite e entrou no workspace.`,
    path: '/settings/members',
  })
}

/**
 * The export is per user, not per workspace, so the notice lands in the
 * inbox of every workspace the user belongs to (one per workspace).
 */
export async function notifyDataExportReady(input: {
  userId: string
  workspaceIds: string[]
  exportId: string
}): Promise<number> {
  let created = 0
  for (const workspaceId of input.workspaceIds) {
    created += await emitNotification({
      workspaceId,
      recipients: [input.userId],
      kind: 'DATA_EXPORT_READY',
      title: 'Sua exportação de dados está pronta',
      body: 'Enviamos o link de download para o seu e-mail. Ele expira em alguns dias.',
      dedupeKey: `data-export:${input.exportId}:${workspaceId}`,
    })
  }
  return created
}

export async function notifyTrialEnded(input: {
  workspaceId: string
  /** `YYYY-MM-DD`; part of the dedupe key. */
  day: string
}): Promise<number> {
  return emitNotification({
    workspaceId: input.workspaceId,
    recipients: await workspaceAdminIds(input.workspaceId),
    kind: 'TRIAL_ENDED',
    title: 'O período de teste terminou',
    body: 'O workspace voltou para o plano gratuito. Assine um plano para manter os recursos pagos.',
    path: BILLING_PATH,
    dedupeKey: `trial-ended:${input.workspaceId}:${input.day}`,
  })
}

export async function notifyBillingPaymentFailed(input: {
  workspaceId: string
  billId: string
  event: string
}): Promise<number> {
  return emitNotification({
    workspaceId: input.workspaceId,
    recipients: await workspaceOwnerIds(input.workspaceId),
    kind: 'BILLING_PAYMENT_FAILED',
    title: 'Falha no pagamento da assinatura',
    body: 'Não conseguimos processar a cobrança. Atualize a forma de pagamento para não perder o plano.',
    path: BILLING_PATH,
    dedupeKey: `billing:${input.event}:${input.billId}`,
  })
}

export async function notifyBillingSubscriptionCanceled(input: {
  workspaceId: string
  billId: string
  expired: boolean
}): Promise<number> {
  return emitNotification({
    workspaceId: input.workspaceId,
    recipients: await workspaceOwnerIds(input.workspaceId),
    kind: 'BILLING_SUBSCRIPTION_CANCELED',
    title: input.expired ? 'Assinatura expirada' : 'Assinatura cancelada',
    body: input.expired
      ? 'A assinatura expirou sem renovação. Os recursos do plano foram desativados.'
      : 'A assinatura foi cancelada. Os recursos do plano foram desativados.',
    path: BILLING_PATH,
    dedupeKey: `billing:${input.expired ? 'expired' : 'cancelled'}:${input.billId}`,
  })
}

/** Once per month per threshold (period + threshold in the dedupe key). */
export async function notifyAiQuota(input: {
  workspaceId: string
  threshold: 'warning' | 'exceeded'
  /** `YYYY-MM` of the quota cycle. */
  period: string
}): Promise<number> {
  const exceeded = input.threshold === 'exceeded'
  return emitNotification({
    workspaceId: input.workspaceId,
    recipients: await workspaceAdminIds(input.workspaceId),
    kind: exceeded ? 'AI_QUOTA_EXCEEDED' : 'AI_QUOTA_WARNING',
    title: exceeded
      ? 'A cota mensal de IA acabou'
      : 'A cota mensal de IA chegou a 80%',
    body: exceeded
      ? 'Os recursos de IA ficam bloqueados até o próximo ciclo ou até a cota ser aumentada.'
      : 'Acompanhe o consumo para a IA não parar antes do fim do mês.',
    path: '/settings/steel-intelligence',
    dedupeKey: `ai-quota:${input.workspaceId}:${input.period}:${input.threshold}`,
  })
}
