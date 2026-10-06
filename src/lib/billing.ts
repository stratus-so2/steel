import 'server-only'
import { BILLING_ENABLED } from '@/lib/env/server'

/**
 * Billing kill-switch (`BILLING_ENABLED`, off by default — product decision
 * of 2026-10-06). While off, nothing talks to AbacatePay: checkout, coupon
 * validation and the webhook answer `BILLING_DISABLED`, the status page drops
 * the "payment" component and the UI hides every upgrade/checkout CTA. Plans
 * and trials set by the global admin keep working. Setting the flag to
 * `'true'` restores the previous behavior unchanged.
 *
 * Server-only on purpose: client components receive the value as a prop from
 * the server component that renders them, so flipping the flag needs a
 * restart, never a rebuild.
 */
export function isBillingEnabled(): boolean {
  return BILLING_ENABLED === 'true'
}
