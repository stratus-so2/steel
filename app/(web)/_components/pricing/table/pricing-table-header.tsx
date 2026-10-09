'use client'

import Link from 'next/link'
import { useQueryState } from 'nuqs'
import { Muted } from '@/components/typography/text/muted'
import { Button } from '@/components/ui/button'
import {
  type Billing,
  formatCurrency,
  formatPlanName,
  getPrice,
  PLAN_ORDER,
  type PlanGrid,
  priceForBilling,
  upgradeUrl,
} from '../plans'
import { billingParser } from '../plans-params'

export function PricingTableHeader({
  billingEnabled,
}: {
  billingEnabled: boolean
}) {
  const [billing] = useQueryState('billing', billingParser)

  return (
    <div className='border-b border-border z-30 hidden lg:sticky lg:top-[72px] lg:flex lg:justify-end bg-background'>
      <div className='w-full lg:w-[30%] p-4 border-border'>
        <span className='font-medium text-xl'>Recursos</span>
      </div>
      <div className='border-border w-full flex shrink-0 justify-evenly lg:w-[70%]'>
        {PLAN_ORDER.map((plan) => (
          <PlanColumn
            key={plan}
            plan={plan}
            billing={billing}
            billingEnabled={billingEnabled}
          />
        ))}
      </div>
    </div>
  )
}

interface PlanColumnProps {
  plan: PlanGrid
  billing: Billing
  billingEnabled: boolean
}

function PlanColumn({ plan, billing, billingEnabled }: PlanColumnProps) {
  const price = getPrice(plan)

  return (
    <div className='flex flex-col gap-3 w-full border-l border-border p-4'>
      <span className='font-medium text-xl'>{formatPlanName(plan)}</span>
      <Muted>
        {price ? (
          <>
            <strong className='font-normal text-base text-primary'>
              {formatCurrency(priceForBilling(price, billing))}
            </strong>{' '}
            por usuário/mês
          </>
        ) : (
          <strong className='font-normal text-base text-primary'>
            Sob consulta
          </strong>
        )}
      </Muted>
      <PlanCta plan={plan} billing={billing} billingEnabled={billingEnabled} />
    </div>
  )
}

function PlanCta({ plan, billing, billingEnabled }: PlanColumnProps) {
  if (plan === 'FREE') {
    return (
      <Button
        variant='outline'
        nativeButton={false}
        render={<Link href='/sign-up'>Criar conta grátis</Link>}
      />
    )
  }

  // Billing off: no self-service checkout, paid plans are sold by sales.
  if (plan === 'ENTERPRISE' || !billingEnabled) {
    return (
      <Button
        nativeButton={false}
        render={<Link href='/talk-to-sales'>Falar com vendas</Link>}
      />
    )
  }

  return (
    <Button
      nativeButton={false}
      render={
        <Link href={upgradeUrl(plan, billing)}>
          Assinar o {formatPlanName(plan)}
        </Link>
      }
    />
  )
}
