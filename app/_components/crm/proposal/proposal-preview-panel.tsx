'use client'

import { Copy01Icon, Download04Icon } from '@hugeicons-pro/core-stroke-rounded'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { notify } from '@/lib/notify'
import type { CrmProposalSectionDTO } from '@/types/crm-proposal'
import { SECTION_REGISTRY } from './sections/registry'

const PDFViewer = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFViewer),
  { ssr: false, loading: () => <PdfPlaceholder /> },
)

function PdfPlaceholder() {
  return (
    <div className='flex h-full items-center justify-center text-muted-foreground text-sm'>
      Carregando pré-visualização…
    </div>
  )
}

/** Preview web (mesmos componentes de display do builder), somente leitura. */
export function ProposalWebPreview({
  sections,
}: {
  sections: CrmProposalSectionDTO[]
}) {
  const enabled = [...sections]
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order)

  if (enabled.length === 0) {
    return (
      <div className='flex h-full items-center justify-center text-muted-foreground text-sm'>
        Habilite ao menos uma seção para pré-visualizar.
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-6'>
      {enabled.map((section) => {
        const { Display } = SECTION_REGISTRY[section.type]
        return <Display key={section.id} content={section.content} />
      })}
    </div>
  )
}

async function downloadPdf(name: string, sections: CrmProposalSectionDTO[]) {
  const [{ pdf }, { ProposalPdfDocument }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./proposal-pdf-document'),
  ])
  const blob = await pdf(
    <ProposalPdfDocument name={name} sections={sections} />,
  ).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name.replace(/[^a-z0-9]/gi, '_') || 'proposta'}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

export function ProposalPreviewPanel({
  name,
  sections,
  shareUrl,
  canShare,
}: {
  name: string
  sections: CrmProposalSectionDTO[]
  shareUrl: string
  canShare: boolean
}) {
  const [tab, setTab] = useState<'web' | 'link' | 'pdf'>('web')
  const [downloading, setDownloading] = useState(false)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      notify.success('Link copiado')
    } catch {
      notify.error('Não foi possível copiar o link')
    }
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await downloadPdf(name, sections)
    } catch {
      notify.error('Não foi possível gerar o PDF')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as typeof tab)}
      className='flex h-full min-h-0 flex-col gap-3'
    >
      <TabsList>
        <TabsTrigger value='web'>Pré-visualização</TabsTrigger>
        <TabsTrigger value='link'>Link</TabsTrigger>
        <TabsTrigger value='pdf'>PDF</TabsTrigger>
      </TabsList>

      <TabsContent value='web' className='min-h-0 flex-1 overflow-y-auto'>
        <ProposalWebPreview sections={sections} />
      </TabsContent>

      <TabsContent value='link' className='flex-1'>
        {canShare ? (
          <div className='flex items-center gap-1.5 rounded-md border bg-muted/40 p-2'>
            <span className='min-w-0 flex-1 truncate text-muted-foreground text-sm'>
              {shareUrl}
            </span>
            <Button
              type='button'
              variant='ghost'
              size='icon-sm'
              aria-label='Copiar link'
              onClick={copyLink}
            >
              <SteelIcon icon={Copy01Icon} strokeWidth={2} />
            </Button>
          </div>
        ) : (
          <p className='text-muted-foreground text-sm'>
            Envie a proposta para gerar o link público de visualização.
          </p>
        )}
      </TabsContent>

      <TabsContent value='pdf' className='flex min-h-0 flex-1 flex-col gap-2'>
        <Button
          type='button'
          variant='outline'
          size='sm'
          className='w-fit'
          disabled={downloading}
          onClick={handleDownload}
        >
          <SteelIcon icon={Download04Icon} strokeWidth={2} />
          {downloading ? 'Gerando…' : 'Baixar PDF'}
        </Button>
        <div className='min-h-0 flex-1 overflow-hidden rounded-md border'>
          {tab === 'pdf' ? (
            <PDFViewerLazy name={name} sections={sections} />
          ) : null}
        </div>
      </TabsContent>
    </Tabs>
  )
}

function PDFViewerLazy({
  name,
  sections,
}: {
  name: string
  sections: CrmProposalSectionDTO[]
}) {
  const [Doc, setDoc] = useState<
    typeof import('./proposal-pdf-document').ProposalPdfDocument | null
  >(null)

  useEffect(() => {
    let active = true
    import('./proposal-pdf-document').then((mod) => {
      if (active) setDoc(() => mod.ProposalPdfDocument)
    })
    return () => {
      active = false
    }
  }, [])

  if (!Doc) return <PdfPlaceholder />

  return (
    <PDFViewer width='100%' height='100%' showToolbar={false}>
      <Doc name={name} sections={sections} />
    </PDFViewer>
  )
}
