import type { Metadata } from 'next'
import { connection } from 'next/server'
import { SdPublicApprovalForm } from '@/app/_components/servicedesk/ticket/approvals/sd-public-approval-form'
import { SdApprovalTokenSchema } from '@/src/schemas/sd-ticket-approval.schema'
import { SdTicketApprovalService } from '@/src/services/sd-ticket-approval.service'

export const metadata: Metadata = {
  title: 'Aprovação de chamado',
  robots: { index: false, follow: false },
}

/**
 * Página pública (sem login) do link de aprovação enviado por e-mail. O GET
 * só mostra o resumo — aprovar/reprovar exige o clique (POST), para que
 * scanners de link não decidam nada sozinhos.
 */
export default async function SdApprovalPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ decision?: string | string[] }>
}) {
  await connection()

  const [{ token }, query] = await Promise.all([params, searchParams])
  const parsed = SdApprovalTokenSchema.safeParse(token)
  const preview = parsed.success
    ? await SdTicketApprovalService.publicPreview(parsed.data)
    : null
  const decision = Array.isArray(query.decision)
    ? query.decision[0]
    : query.decision
  const initialDecision =
    decision === 'APPROVED' || decision === 'REJECTED' ? decision : null

  return (
    <div className='flex min-h-screen items-center justify-center bg-muted/30 p-6'>
      <div className='w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-sm'>
        {preview?.ok ? (
          <SdPublicApprovalForm
            token={token}
            approval={preview.value}
            initialDecision={initialDecision}
          />
        ) : (
          <div className='space-y-2'>
            <h1 className='font-semibold text-lg'>Link inválido</h1>
            <p className='text-muted-foreground text-sm'>
              Não encontramos este pedido de aprovação. Verifique se copiou o
              endereço completo do e-mail ou peça um novo link ao responsável
              pelo chamado.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
