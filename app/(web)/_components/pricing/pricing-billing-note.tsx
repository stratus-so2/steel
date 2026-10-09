import { Muted } from '@/components/typography/text/muted'

/** Next to the monthly/yearly switch: how paid plans are bought today. */
export function PricingBillingNote({
  billingEnabled,
}: {
  billingEnabled: boolean
}) {
  return (
    <Muted className='text-sm sm:text-right'>
      {billingEnabled
        ? 'Preços por usuário, por mês. Planos pagos com contratação online.'
        : 'Preços de referência por usuário, por mês. A contratação dos planos pagos é feita com a nossa equipe comercial.'}
    </Muted>
  )
}
