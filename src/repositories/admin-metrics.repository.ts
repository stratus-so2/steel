import type { EndedSubscription, PayingSubscription } from '@/src/lib/metrics'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

/** Leituras agregadas (cross-workspace) para o painel de métricas do admin. */
export const AdminMetricsRepository = {
  async countWorkspaces(): Promise<Result<number>> {
    try {
      return ok(await prisma.workspace.count())
    } catch (error) {
      return err(dbError('Failed to count workspaces', error))
    }
  },

  /** Workspaces com algum membro cuja sessão foi usada/renovada desde `since`. */
  async countWorkspacesWithLoginSince(since: Date): Promise<Result<number>> {
    try {
      const count = await prisma.workspace.count({
        where: {
          memberships: {
            some: {
              user: { sessions: { some: { updatedAt: { gte: since } } } },
            },
          },
        },
      })
      return ok(count)
    } catch (error) {
      return err(dbError('Failed to count workspaces with login', error))
    }
  },

  /**
   * Assinaturas PAID de workspaces hoje em plano pago, da mais recente para a
   * mais antiga (o cálculo do MRR usa só a primeira de cada workspace).
   * Workspaces pagos sem assinatura (ex.: ENTERPRISE negociado fora do
   * AbacatePay, trial) não entram.
   */
  async listPayingSubscriptions(): Promise<Result<PayingSubscription[]>> {
    try {
      const subs = await prisma.subscription.findMany({
        where: { status: 'PAID', workspace: { activePlan: { not: 'FREE' } } },
        orderBy: { createdAt: 'desc' },
        select: { workspaceId: true, amount: true, interval: true },
      })
      return ok(subs)
    } catch (error) {
      return err(dbError('Failed to list paying subscriptions', error))
    }
  },

  /**
   * Assinaturas encerradas (CANCELLED/EXPIRED) desde `since`, datadas pelo
   * `updatedAt` — o schema não guarda a data do cancelamento em si.
   */
  async listEndedSubscriptionsSince(
    since: Date,
  ): Promise<Result<EndedSubscription[]>> {
    try {
      const subs = await prisma.subscription.findMany({
        where: {
          status: { in: ['CANCELLED', 'EXPIRED'] },
          updatedAt: { gte: since },
        },
        select: { status: true, amount: true, interval: true, updatedAt: true },
      })
      return ok(
        subs.map(({ updatedAt, ...rest }) => ({ ...rest, endedAt: updatedAt })),
      )
    } catch (error) {
      return err(dbError('Failed to list ended subscriptions', error))
    }
  },
}
