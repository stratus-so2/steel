import { ButtonLink } from '@/components/button-link'
import { Muted } from '@/components/typography/text/muted'

/** "Relate um problema" leads to the contact page, which lists the channels. */
export const STATUS_REPORT_HREF = '/contact'

/**
 * Title row shared by the status pages. Nexo repeats its logo here; the site
 * header above already carries Steel's, so this row names the page instead
 * and keeps Nexo's action on the right.
 */
export function StatusPageHeader() {
  return (
    <div className='w-full flex flex-wrap items-center justify-between gap-3'>
      <div className='space-y-0.5'>
        <h1 className='text-xl font-semibold'>Status do Steel</h1>
        <Muted>Disponibilidade dos serviços nos últimos 90 dias.</Muted>
      </div>
      <ButtonLink href={STATUS_REPORT_HREF} variant='outline' size='sm'>
        Relate um problema
      </ButtonLink>
    </div>
  )
}
