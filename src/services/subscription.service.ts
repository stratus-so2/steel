import type { BillingInterval, Plan, Subscription } from '@prisma/client'
import { AbacatePayClient } from '@/lib/abacatepay'
import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import { BETTER_AUTH_URL } from '@/lib/env/server'
import { WorkspaceCache } from '@/src/cache/workspace.cache'
import { WorkspaceFeaturesCache } from '@/src/cache/workspace-features.cache'
import { forbidden, paymentError } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { toSubscriptionDTO } from '@/src/mappers/subscription.mapper'
import { SubscriptionRepository } from '@/src/repositories/subscription.repository'
import type { CreateSubscriptionDTO } from '@/src/schemas/subscription.schema'
import type { SubscriptionDTO } from '@/types/subscription'
import { PAID_PLAN_PRICES } from '../config/plan-prices'
import { assertMember } from './authz'
import { CouponService } from './coupon.service'

const PLAN_PRODUCTS: Record<
  CreateSubscriptionDTO['plan'],
  Record<CreateSubscriptionDTO['interval'], string>
> = {
  PRO: {
    monthly: 'prod_hhYrXssxdQuRx1TcNAH4YpH3',
    yearly: 'prod_3ShyESQSCAS4YtUhaPj6cJMR',
  },
  BUSINESS: {
    monthly: 'prod_BgZbxqmJKdRgdFMBGjgJHWzh',
    yearly: 'prod_pKMcBAhqDXZUyTcn4geBPDje',
  },
}

function intervalToPrisma(
  interval: CreateSubscriptionDTO['interval'],
): BillingInterval {
  return interval === 'yearly' ? 'YEARLY' : 'MONTHLY'
}

/** De onde partiu o cancelamento em massa (só para auditoria/log). */
export type SubscriptionCancellationSource =
  | 'admin_workspace_deletion'
  | 'owner_workspace_deletion'

export interface SubscriptionCancellationAttempt {
  billId: string
  plan: string
  /** Status local **antes** da tentativa (`PAID` ou `PENDING`). */
  status: string
  interval: string
  outcome: 'CANCELLED' | 'FAILED'
  /** Mensagem crua do provedor quando `outcome === 'FAILED'`. */
  error: string | null
}

export interface WorkspaceSubscriptionCancellationReport {
  attempts: SubscriptionCancellationAttempt[]
  cancelled: SubscriptionCancellationAttempt[]
  failed: SubscriptionCancellationAttempt[]
}

export const SubscriptionService = {
  async create(
    actorId: string,
    dto: CreateSubscriptionDTO,
  ): Promise<Result<SubscriptionDTO>> {
    const membership = await assertMember(actorId, dto.workspaceId)
    if (!membership.ok) return membership

    if (!membership.value.isPrivileged) {
      return err(forbidden('Apenas OWNER ou ADMIN podem alterar o plano'))
    }

    if (dto.coupon) {
      const coupon = await CouponService.validate({ code: dto.coupon })
      if (!coupon.ok) return coupon
    }

    const productId = PLAN_PRODUCTS[dto.plan][dto.interval]
    const appUrl = BETTER_AUTH_URL

    let bill: Awaited<
      ReturnType<typeof AbacatePayClient.createSubscription>
    >['data']
    try {
      const response = await AbacatePayClient.createSubscription({
        items: [{ id: productId, quantity: dto.seats }],
        methods: ['CARD'],
        returnUrl: appUrl,
        completionUrl: appUrl,
        ...(dto.coupon ? { coupons: [dto.coupon] } : {}),
        metadata: {
          workspaceId: dto.workspaceId,
          plan: dto.plan,
          seats: dto.seats,
          interval: dto.interval,
          ...(dto.coupon ? { coupons: dto.coupon } : {}),
        },
      })
      bill = response.data
    } catch (error) {
      logger.error('subscription.gateway_failed', {
        workspaceId: dto.workspaceId,
        plan: dto.plan,
        interval: dto.interval,
        seats: dto.seats,
        message: error instanceof Error ? error.message : String(error),
      })
      auditMutation({
        entity: 'subscription',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: 'PAYMENT_ERROR',
        meta: { workspaceId: dto.workspaceId, plan: dto.plan },
      })
      return err(paymentError())
    }

    const listAmount = PAID_PLAN_PRICES[dto.plan][dto.interval] * dto.seats
    const amountValid = dto.coupon
      ? bill.amount >= 0 && bill.amount <= listAmount
      : bill.amount === listAmount

    if (!amountValid) {
      logger.error('subscription.amount_mismatch', {
        workspaceId: dto.workspaceId,
        plan: dto.plan,
        interval: dto.interval,
        seats: dto.seats,
        coupon: dto.coupon ?? null,
        expected: listAmount,
        charged: bill.amount,
        billId: bill.id,
      })
      auditMutation({
        entity: 'subscription',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: 'PAYMENT_AMOUNT_MISMATCH',
        meta: {
          workspaceId: dto.workspaceId,
          plan: dto.plan,
          expected: listAmount,
          charged: bill.amount,
        },
      })
      return err(paymentError('Valor cobrado divergente do esperado'))
    }

    const result = await SubscriptionRepository.create({
      billId: bill.id,
      plan: dto.plan as Plan,
      status: 'PENDING',
      amount: bill.amount,
      paymentUrl: bill.url,
      workspaceId: dto.workspaceId,
      seats: dto.seats,
      interval: intervalToPrisma(dto.interval),
      coupon: dto.coupon ?? null,
    })

    if (!result.ok) {
      auditMutation({
        entity: 'subscription',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
        meta: {
          workspaceId: dto.workspaceId,
          plan: dto.plan,
          seats: dto.seats,
          interval: dto.interval,
        },
      })
      return result
    }

    auditMutation({
      entity: 'subscription',
      action: 'create',
      actorId,
      targetId: result.value.id,
      meta: {
        workspaceId: dto.workspaceId,
        plan: dto.plan,
        billId: bill.id,
        seats: dto.seats,
        interval: dto.interval,
        coupon: dto.coupon ?? null,
      },
    })

    return ok(toSubscriptionDTO(result.value))
  },

  async handleWebhookEvent(
    event: string,
    billId: string,
  ): Promise<Result<void>> {
    const subscription = await SubscriptionRepository.findByBillId(billId)
    if (!subscription.ok) return subscription

    switch (event) {
      case 'subscription.completed': {
        const result = await SubscriptionRepository.activateWithPlan(
          billId,
          subscription.value.plan,
        )
        if (!result.ok) {
          auditMutation({
            entity: 'subscription',
            action: 'activate',
            actorId: null,
            targetId: subscription.value.id,
            outcome: 'failure',
            reason: result.error.code,
            meta: { billId, source: 'webhook' },
          })
          return result
        }

        await Promise.all([
          WorkspaceCache.invalidate(subscription.value.workspaceId),
          WorkspaceFeaturesCache.invalidate(subscription.value.workspaceId),
        ])
        auditMutation({
          entity: 'subscription',
          action: 'activate',
          actorId: null,
          targetId: subscription.value.id,
          meta: {
            billId,
            workspaceId: subscription.value.workspaceId,
            plan: subscription.value.plan,
            source: 'webhook',
          },
        })
        return ok(undefined)
      }

      case 'subscription.cancelled':
      case 'subscription.expired': {
        const status =
          event === 'subscription.expired' ? 'EXPIRED' : 'CANCELLED'
        const result = await SubscriptionRepository.deactivateByBillId(
          billId,
          status,
        )
        if (!result.ok) {
          auditMutation({
            entity: 'subscription',
            action: 'cancel',
            actorId: null,
            targetId: subscription.value.id,
            outcome: 'failure',
            reason: result.error.code,
            meta: { billId, event, source: 'webhook' },
          })
          return result
        }

        await Promise.all([
          WorkspaceCache.invalidate(subscription.value.workspaceId),
          WorkspaceFeaturesCache.invalidate(subscription.value.workspaceId),
        ])
        auditMutation({
          entity: 'subscription',
          action: 'cancel',
          actorId: null,
          targetId: subscription.value.id,
          meta: {
            billId,
            event,
            workspaceId: subscription.value.workspaceId,
            source: 'webhook',
          },
        })

        return ok(undefined)
      }

      default:
        return ok(undefined)
    }
  },

  /**
   * Cancela no AbacatePay **todas** as assinaturas cobráveis (`PAID` e
   * `PENDING`) de um workspace. Usado antes de apagar o workspace (painel
   * admin e exclusão pelo OWNER) para que nunca sobre cobrança viva sem
   * workspace do outro lado.
   *
   * Nunca lança e nunca "cancela em silêncio": cada assinatura vira uma
   * tentativa auditada no relatório. Quem chama decide a política sobre
   * `report.failed` (o padrão do projeto é **barrar** a exclusão).
   */
  async cancelWorkspaceSubscriptions(params: {
    workspaceId: string
    actorId: string | null
    source: SubscriptionCancellationSource
  }): Promise<Result<WorkspaceSubscriptionCancellationReport>> {
    const { workspaceId, actorId, source } = params

    const found =
      await SubscriptionRepository.listCancellableByWorkspaceId(workspaceId)
    if (!found.ok) return found

    const attempts: SubscriptionCancellationAttempt[] = []

    // Sequencial de propósito: são poucas assinaturas por workspace e a
    // ordem das tentativas precisa bater com a ordem da auditoria.
    for (const subscription of found.value) {
      const base = {
        billId: subscription.billId,
        plan: String(subscription.plan),
        status: String(subscription.status),
        interval: String(subscription.interval),
      }

      try {
        await AbacatePayClient.cancelSubscription(subscription.billId)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error('subscription.cancel_failed', {
          workspaceId,
          billId: subscription.billId,
          plan: subscription.plan,
          source,
          message,
        })
        auditMutation({
          entity: 'subscription',
          action: 'cancel',
          actorId,
          targetId: subscription.id,
          outcome: 'failure',
          reason: 'SUBSCRIPTION_CANCEL_FAILED',
          meta: { workspaceId, billId: subscription.billId, source, message },
        })
        attempts.push({ ...base, outcome: 'FAILED', error: message })
        continue
      }

      // O provedor já cancelou: a partir daqui a cobrança está morta. Uma
      // falha ao gravar o status local não desfaz isso — só vira log.
      const updated = await SubscriptionRepository.deactivateByBillId(
        subscription.billId,
        'CANCELLED',
      )
      if (!updated.ok) {
        logger.error('subscription.cancel_local_update_failed', {
          workspaceId,
          billId: subscription.billId,
          source,
          reason: updated.error.code,
        })
      }

      auditMutation({
        entity: 'subscription',
        action: 'cancel',
        actorId,
        targetId: subscription.id,
        meta: {
          workspaceId,
          billId: subscription.billId,
          plan: subscription.plan,
          previousStatus: subscription.status,
          source,
        },
      })
      attempts.push({ ...base, outcome: 'CANCELLED', error: null })
    }

    if (attempts.length > 0) {
      await Promise.all([
        WorkspaceCache.invalidate(workspaceId),
        WorkspaceFeaturesCache.invalidate(workspaceId),
      ])
    }

    return ok({
      attempts,
      cancelled: attempts.filter((a) => a.outcome === 'CANCELLED'),
      failed: attempts.filter((a) => a.outcome === 'FAILED'),
    })
  },

  async getActiveByWorkspace(
    workspaceId: string,
  ): Promise<Result<Subscription | null>> {
    return SubscriptionRepository.findActiveByWorkspaceId(workspaceId)
  },
}
