import 'server-only'
import { isBillingEnabled } from '@/src/lib/billing'
import { COMPONENTS, type ComponentDefinition } from './components'

/**
 * Components the status page collects and displays right now. `COMPONENTS`
 * stays the full catalog (it names old incidents and history rows); the
 * "payment" component only exists while billing is on — there is no point
 * probing a provider the platform does not use.
 */
export function activeComponents(): ReadonlyArray<ComponentDefinition> {
  if (isBillingEnabled()) return COMPONENTS
  return COMPONENTS.filter((c) => c.key !== 'payment')
}
