import type { Metadata } from 'next'
import { connection } from 'next/server'
import { LandingPageTracker } from '@/app/_components/crm/landing-page/landing-page-tracker'
import { LandingPageWebPreview } from '@/app/_components/crm/landing-page/landing-page-web-preview'
import { CrmLandingPageService } from '@/src/services/crm-landing-page.service'

type PageProps = { params: Promise<{ shareToken: string }> }

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { shareToken } = await params
  const result = await CrmLandingPageService.getPublicByShareToken(shareToken)
  return { title: result.ok ? result.value.title : 'Página indisponível' }
}

export default async function PublicCrmLandingPage({ params }: PageProps) {
  // Depende de estado ao vivo (publicação pode mudar) — nunca prerenderizar.
  await connection()

  const { shareToken } = await params
  const result = await CrmLandingPageService.getPublicByShareToken(shareToken)

  if (!result.ok) {
    return (
      <main className='flex min-h-svh flex-col items-center justify-center gap-2 px-6 text-center'>
        <h1 className='font-semibold text-lg'>Página indisponível</h1>
        <p className='max-w-md text-muted-foreground text-sm'>
          Este link pode ter sido despublicado ou não existe mais.
        </p>
      </main>
    )
  }

  return (
    <main data-template={result.value.templateKey}>
      <LandingPageWebPreview sections={result.value.sections} />
      <LandingPageTracker token={shareToken} />
    </main>
  )
}
