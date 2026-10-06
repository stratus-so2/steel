import { CreditCardNotAcceptIcon } from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { SteelIcon } from '@/components/icon/icon'
import { Muted } from '@/components/typography/text/muted'
import { Button } from '@/components/ui/button'

/**
 * Shown in place of the upgrade grid while billing is off (`BILLING_ENABLED`):
 * there is no self-service checkout, so plans go through Stratus Telecom.
 */
export function BillingUnavailable() {
  return (
    <div
      role='status'
      className='w-full bg-muted flex items-center px-4 py-3 gap-3 rounded-lg border border-border'
    >
      <div className='p-2 rounded-sm bg-background w-fit flex items-center justify-center'>
        <SteelIcon
          icon={CreditCardNotAcceptIcon}
          className='text-muted-foreground'
          size={24}
        />
      </div>
      <div className='flex-1 flex flex-col gap-1 min-w-0'>
        <h4 className='font-semibold text-sm'>
          Planos e cobrança indisponíveis no momento
        </h4>
        <Muted>
          A contratação e a troca de plano pelo Steel estão desativadas. Para
          mudar o plano do seu workspace, fale com a Stratus Telecom.
        </Muted>
      </div>
      <Button
        variant='outline'
        size='sm'
        nativeButton={false}
        render={<Link href='/talk-to-sales'>Falar com a Stratus Telecom</Link>}
      />
    </div>
  )
}
