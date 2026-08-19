'use client'

import { ImageUploadField } from '@/app/_components/crm/proposal/proposal-image-upload'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { CrmProposalSectionContent } from '@/src/schemas/crm-proposal.schema'

export type SignatureContent = Extract<
  CrmProposalSectionContent,
  { type: 'SIGNATURE' }
>

export function signatureDefaultContent(ctx: {
  responsibleName?: string
}): SignatureContent {
  return {
    type: 'SIGNATURE',
    companySignerName: ctx.responsibleName || 'Responsável pela empresa',
  }
}

export function SignatureEditor({
  content,
  onChange,
  workspaceId,
}: {
  content: SignatureContent
  onChange: (content: SignatureContent) => void
  workspaceId: string
}) {
  return (
    <div className='flex flex-col gap-4'>
      <Field>
        <FieldLabel htmlFor='company-signer-name'>
          Responsável pela empresa
        </FieldLabel>
        <Input
          id='company-signer-name'
          value={content.companySignerName}
          onChange={(e) =>
            onChange({ ...content, companySignerName: e.target.value })
          }
        />
      </Field>
      <Field>
        <FieldLabel htmlFor='company-signer-role'>Cargo</FieldLabel>
        <Input
          id='company-signer-role'
          value={content.companySignerRole ?? ''}
          onChange={(e) =>
            onChange({
              ...content,
              companySignerRole: e.target.value || undefined,
            })
          }
        />
      </Field>
      <Field>
        <FieldLabel htmlFor='client-signer-name'>
          Responsável pelo cliente
        </FieldLabel>
        <Input
          id='client-signer-name'
          value={content.clientSignerName ?? ''}
          onChange={(e) =>
            onChange({
              ...content,
              clientSignerName: e.target.value || undefined,
            })
          }
          placeholder='Preenchido pelo cliente, se necessário'
        />
      </Field>
      <ImageUploadField
        workspaceId={workspaceId}
        label='Imagem da assinatura'
        value={content.signatureImageUrl}
        onChange={(url) => onChange({ ...content, signatureImageUrl: url })}
      />
    </div>
  )
}

export function SignatureDisplay({ content }: { content: SignatureContent }) {
  return (
    <section className='flex flex-col gap-6 rounded-lg border p-8'>
      <h2 className='font-semibold text-2xl'>Assinatura</h2>
      <div className='grid grid-cols-2 gap-8'>
        <div className='flex flex-col gap-2'>
          {content.signatureImageUrl ? (
            <img
              src={content.signatureImageUrl}
              alt='Assinatura'
              className='h-16 w-auto object-contain'
            />
          ) : (
            <div className='h-16 border-b' />
          )}
          <p className='font-medium'>{content.companySignerName}</p>
          {content.companySignerRole ? (
            <p className='text-muted-foreground text-sm'>
              {content.companySignerRole}
            </p>
          ) : null}
        </div>
        <div className='flex flex-col gap-2'>
          <div className='h-16 border-b' />
          <p className='font-medium'>{content.clientSignerName || 'Cliente'}</p>
        </div>
      </div>
    </section>
  )
}
