import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { CrmPublicFormRenderer } from '@/app/_components/crm/crm-public-form-renderer'
import { CrmFormService } from '@/src/services/crm-form.service'

export const metadata: Metadata = {
  title: 'Formulário',
}

export default async function PublicCrmFormPage({
  params,
}: {
  params: Promise<{ publicToken: string }>
}) {
  // Depende de estado ao vivo (status de publicação) — nunca prerenderizar.
  await connection()

  const { publicToken } = await params

  const result = await CrmFormService.getPublicByToken(publicToken)
  if (!result.ok) notFound()

  return (
    <div className='flex min-h-screen items-center justify-center bg-muted/30 p-6'>
      <div className='w-full max-w-xl'>
        <CrmPublicFormRenderer form={result.value} publicToken={publicToken} />
      </div>
    </div>
  )
}
