'use client'

import { CheckIcon } from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { useQueryState } from 'nuqs'
import { SteelIcon } from '@/components/icon/icon'
import { Muted } from '@/components/typography/text/muted'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  formatCurrency,
  formatPlanName,
  getPrice,
  PLANS,
  type PlanGrid,
  priceForBilling,
  upgradeUrl,
  yearlyDiscount,
} from './plans'
import { billingParser } from './plans-params'

interface PricingCardPlanProps {
  plan: PlanGrid
  /** Billing off: paid plans have no checkout, the CTA goes to sales. */
  billingEnabled: boolean
}

export function PricingCardPlan({
  plan,
  billingEnabled,
}: PricingCardPlanProps) {
  const [billing] = useQueryState('billing', billingParser)

  const { description, features } = PLANS[plan]
  const price = getPrice(plan)
  const discount = price ? yearlyDiscount(price) : 0

  return (
    <div className='border border-border w-full'>
      <div className='flex flex-col gap-6 border-b border-border p-6'>
        <div className='flex items-center justify-between'>
          <h5 className='font-medium text-base'>{formatPlanName(plan)}</h5>
          {discount > 0 && (
            <Muted className='text-orange-700 dark:text-orange-300 text-xs font-medium'>
              ECONOMIZE {Math.round(discount * 100)}%
            </Muted>
          )}
        </div>
        <div className='flex flex-col gap-6'>
          <div className='h-12 flex items-center gap-2'>
            {price ? (
              <>
                <h5 className='text-2xl font-medium'>
                  {formatCurrency(priceForBilling(price, billing))}
                </h5>
                <Muted>por usuário/mês</Muted>
              </>
            ) : (
              <h5 className='text-2xl font-medium'>Sob consulta</h5>
            )}
          </div>
          <Muted className='text-sm xl:min-h-15'>{description}</Muted>
          <div className='flex flex-col gap-2'>
            {plan === 'FREE' ? (
              <Button
                nativeButton={false}
                size='sm'
                variant='outline'
                className='w-full'
                render={<Link href='/sign-up'>Criar conta grátis</Link>}
              />
            ) : plan === 'ENTERPRISE' || !billingEnabled ? (
              <Button
                nativeButton={false}
                size='sm'
                className='w-full'
                render={<Link href='/talk-to-sales'>Falar com vendas</Link>}
              />
            ) : (
              <Button
                nativeButton={false}
                size='sm'
                className='w-full'
                render={
                  <Link href={upgradeUrl(plan, billing)}>
                    Assinar o {formatPlanName(plan)}
                  </Link>
                }
              />
            )}
          </div>
        </div>
      </div>
      <div className='flex flex-col gap-6 p-6'>
        <div className='flex flex-col gap-3'>
          <Muted className='text-primary font-semibold text-sm'>Inclui</Muted>
          <ul className='flex flex-col gap-3'>
            {features.map((feature) => (
              <li key={feature.title}>
                <Tooltip>
                  <TooltipTrigger className='text-start flex items-center gap-1.5 hover:underline'>
                    <SteelIcon icon={CheckIcon} size={20} strokeWidth={2} />
                    {feature.title}
                  </TooltipTrigger>
                  <TooltipContent
                    side='bottom'
                    align='start'
                    className='text-sm'
                  >
                    {feature.description}
                  </TooltipContent>
                </Tooltip>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
