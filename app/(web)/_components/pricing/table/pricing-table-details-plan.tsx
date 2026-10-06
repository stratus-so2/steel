import { PricingTableGroup } from './pricing-table-group'
import { PricingTableHeader } from './pricing-table-header'

export function PricingTableDetailsPlan({
  billingEnabled,
}: {
  billingEnabled: boolean
}) {
  return (
    <div className='relative border-x border-border w-full mb-20' id='features'>
      <PricingTableHeader billingEnabled={billingEnabled} />
      <PricingTableGroup />
    </div>
  )
}
