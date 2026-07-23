import type { Metadata } from 'next'
import { connection } from 'next/server'
import { ProposalTracker } from '@/app/_components/crm/proposal/proposal-tracker'
import { ProposalViewer } from '@/app/_components/crm/proposal/proposal-viewer'
import { CrmProposalService } from '@/src/services/crm-proposal.service'

type PageProps = { params: Promise<{ shareToken: string }> }

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { shareToken } = await params
  const result = await CrmProposalService.getPublicByShareToken(shareToken)
  return { title: result.ok ? result.value.title : 'Proposta' }
}

export default async function PublicCrmProposalPage({ params }: PageProps) {
  // Depende de estado ao vivo (status de publicação) — nunca prerenderizar.
  await connection()

  const { shareToken } = await params
  const result = await CrmProposalService.getPublicByShareToken(shareToken)

  if (!result.ok) {
    return (
      <main className='flex min-h-svh flex-col items-center justify-center gap-2 px-6 text-center'>
        <h1 className='font-semibold text-lg'>Proposta indisponível</h1>
        <p className='max-w-md text-muted-foreground text-sm'>
          Este link pode ter sido despublicado ou não existe mais. Peça um novo
          link para quem compartilhou a proposta.
        </p>
      </main>
    )
  }

  const proposal = result.value

  return (
    <main className='mx-auto min-h-svh w-full max-w-3xl px-6 py-12 sm:py-16'>
      <article>
        <h1 className='mb-6 text-balance font-semibold text-3xl tracking-tight'>
          {proposal.title}
        </h1>
        <ProposalViewer content={proposal.content} />
      </article>
      <ProposalTracker token={shareToken} />
    </main>
  )
}
