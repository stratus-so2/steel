'use client'

import { Field, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import type { CrmProposalSectionContent } from '@/src/schemas/crm-proposal.schema'

export type CommercialTermsContent = Extract<
  CrmProposalSectionContent,
  { type: 'COMMERCIAL_TERMS' }
>

export function commercialTermsDefaultContent(): CommercialTermsContent {
  return {
    type: 'COMMERCIAL_TERMS',
    paymentTerms: 'Definir condições de pagamento.',
  }
}

export function CommercialTermsEditor({
  content,
  onChange,
}: {
  content: CommercialTermsContent
  onChange: (content: CommercialTermsContent) => void
}) {
  return (
    <div className='flex flex-col gap-4'>
      <Field>
        <FieldLabel htmlFor='payment-terms'>Condições de pagamento</FieldLabel>
        <Textarea
          id='payment-terms'
          rows={4}
          value={content.paymentTerms}
          onChange={(e) =>
            onChange({ ...content, paymentTerms: e.target.value })
          }
        />
      </Field>
      <Field>
        <FieldLabel htmlFor='delivery-terms'>Prazo de entrega</FieldLabel>
        <Textarea
          id='delivery-terms'
          rows={3}
          value={content.deliveryTerms ?? ''}
          onChange={(e) =>
            onChange({
              ...content,
              deliveryTerms: e.target.value || undefined,
            })
          }
        />
      </Field>
      <Field>
        <FieldLabel htmlFor='commercial-notes'>Observações</FieldLabel>
        <Textarea
          id='commercial-notes'
          rows={3}
          value={content.notes ?? ''}
          onChange={(e) =>
            onChange({ ...content, notes: e.target.value || undefined })
          }
        />
      </Field>
    </div>
  )
}

export function CommercialTermsDisplay({
  content,
}: {
  content: CommercialTermsContent
}) {
  return (
    <section className='flex flex-col gap-4 rounded-lg border p-8'>
      <h2 className='font-semibold text-2xl'>Condições comerciais</h2>
      <div>
        <p className='font-medium text-sm'>Pagamento</p>
        <p className='whitespace-pre-wrap text-muted-foreground'>
          {content.paymentTerms}
        </p>
      </div>
      {content.deliveryTerms ? (
        <div>
          <p className='font-medium text-sm'>Entrega</p>
          <p className='whitespace-pre-wrap text-muted-foreground'>
            {content.deliveryTerms}
          </p>
        </div>
      ) : null}
      {content.notes ? (
        <div>
          <p className='font-medium text-sm'>Observações</p>
          <p className='whitespace-pre-wrap text-muted-foreground'>
            {content.notes}
          </p>
        </div>
      ) : null}
    </section>
  )
}
