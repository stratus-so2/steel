import type { Metadata } from 'next'
import { connection } from 'next/server'
import { CrmUnsubscribeConfirm } from '@/app/_components/crm/crm-unsubscribe-confirm'
import { CrmEmailUnsubscribeSchema } from '@/src/schemas/crm-email-opt-out.schema'
import { CrmEmailOptOutService } from '@/src/services/crm-email-opt-out.service'

export const metadata: Metadata = {
  title: 'Descadastrar e-mails',
  robots: { index: false, follow: false },
}

/**
 * Página pública (sem login) do link de descadastro das campanhas de e-mail.
 * O GET só mostra o endereço — o descadastro exige o clique (POST), para que
 * scanners de link não descadastrem ninguém sozinhos.
 */
export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  await connection()

  const { token } = await params
  const parsed = CrmEmailUnsubscribeSchema.safeParse({ token })
  const preview = parsed.success
    ? await CrmEmailOptOutService.preview(parsed.data.token)
    : null

  return (
    <div className='flex min-h-screen items-center justify-center bg-muted/30 p-6'>
      <div className='w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm'>
        {preview?.ok ? (
          <CrmUnsubscribeConfirm token={token} email={preview.value.email} />
        ) : (
          <div className='space-y-2'>
            <h1 className='font-semibold text-lg'>Link inválido</h1>
            <p className='text-muted-foreground text-sm'>
              Não conseguimos identificar este link de descadastro. Verifique se
              copiou o endereço completo do e-mail recebido.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
