import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { isBillingEnabled } from '@/src/lib/billing'
import { MembershipService } from '@/src/services/membership.service'
import { UpgradeForm } from './upgrade-form'

const BILLING_ROLES = ['OWNER', 'ADMIN'] as const

export default async function UpgradePage() {
  // Request time, not build time: the flag is read on every request so
  // flipping it needs a restart, never a rebuild.
  await connection()
  // Billing off: there is no checkout to start — plans go through sales.
  if (!isBillingEnabled()) redirect('/talk-to-sales')

  const session = await getAuthSession()
  if (!session.ok) redirect('/sign-in?redirect=%2Fupgrade')

  const memberships = await MembershipService.listByUser(session.value.user.id)

  const workspaces = memberships.ok
    ? memberships.value
        .filter((m) => BILLING_ROLES.includes(m.role as never))
        .map((m) => ({
          id: m.workspace.id,
          name: m.workspace.name,
          activePlan: m.workspace.activePlan,
        }))
    : []

  return <UpgradeForm workspaces={workspaces} />
}
