import type { Prisma } from '@prisma/client'
import {
  type AuditAction,
  type AuditEntity,
  auditMutation,
} from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import { AdminAuditLogRepository } from '@/src/repositories/admin-audit-log.repository'

export interface AdminActor {
  userId: string
  email: string
}

export interface RecordAdminActionInput {
  actor: AdminActor
  /** `<alvo>.<ação>` para o painel, ex.: `workspace.suspend`. */
  action: string
  /** Par entity/action do `auditMutation` (Axiom). */
  audit: { entity: AuditEntity; action: AuditAction }
  targetType: 'workspace' | 'backup' | 'platform'
  targetId?: string | null
  targetLabel?: string | null
  reason?: string | null
  outcome?: 'success' | 'failure'
  meta?: Record<string, unknown>
}

/**
 * Trilha de auditoria de uma ação do admin global em dois lugares: Axiom
 * (`auditMutation`, padrão LGPD do projeto) e a tabela `admin_audit_logs`,
 * que o painel lista e que sobrevive à exclusão do alvo. Nunca falha a ação:
 * erro ao gravar a linha só é logado (o Axiom já recebeu o evento).
 */
export async function recordAdminAction(
  input: RecordAdminActionInput,
): Promise<void> {
  auditMutation({
    entity: input.audit.entity,
    action: input.audit.action,
    actorId: input.actor.userId,
    targetId: input.targetId ?? null,
    outcome: input.outcome,
    reason: input.reason ?? undefined,
    meta: { adminAction: input.action, ...(input.meta ?? {}) },
  })

  await persistAdminAction(input)
}

/**
 * Só a linha em `admin_audit_logs`, para ações cujo service já emite o
 * `auditMutation` próprio (módulos, feature flags).
 */
export async function persistAdminAction(
  input: Omit<RecordAdminActionInput, 'audit'>,
): Promise<void> {
  const meta =
    input.outcome === 'failure'
      ? { ...(input.meta ?? {}), outcome: 'failure' }
      : input.meta

  const saved = await AdminAuditLogRepository.create({
    actorId: input.actor.userId,
    actorEmail: input.actor.email,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    targetLabel: input.targetLabel ?? null,
    reason: input.reason ?? null,
    ...(meta && { meta: meta as Prisma.InputJsonValue }),
  })
  if (!saved.ok) {
    logger.error('admin_audit.persist_failed', {
      action: input.action,
      targetId: input.targetId ?? null,
    })
  }
}
