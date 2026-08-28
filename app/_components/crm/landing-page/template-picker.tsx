'use client'

import { Add01Icon } from '@hugeicons-pro/core-stroke-rounded'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { notify } from '@/lib/notify'
import { useCreateCrmLandingPage } from '@/src/hooks/use-crm-landing-page'
import { LANDING_PAGE_TEMPLATE_CATALOG } from '@/src/lib/landing-page-templates'

/**
 * Grade de escolha dos modelos fixos. Ao escolher um, cria a página já
 * semeada com as seções default do template e navega pro builder.
 */
export function LandingPageTemplatePicker({
  workspaceId,
  slug,
}: {
  workspaceId: string
  slug: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const createPage = useCreateCrmLandingPage(workspaceId)

  async function pick(templateKey: string) {
    const template = LANDING_PAGE_TEMPLATE_CATALOG[templateKey]
    if (!template) return
    try {
      const page = await createPage.mutateAsync({
        title: template.name,
        templateKey,
        sections: template.sections.map((section, index) => ({
          type: section.type,
          order: index,
          enabled: true,
          content: section.content,
        })),
      })
      setOpen(false)
      router.push(`/${slug}/crm/landing-pages/${page.id}`)
    } catch (error) {
      notify.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível criar a página.',
      )
    }
  }

  return (
    <>
      <Button size='sm' onClick={() => setOpen(true)}>
        <SteelIcon icon={Add01Icon} strokeWidth={2} />
        Nova página
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>Escolha um modelo</DialogTitle>
          </DialogHeader>
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
            {Object.values(LANDING_PAGE_TEMPLATE_CATALOG).map((template) => (
              <button
                key={template.key}
                type='button'
                disabled={createPage.isPending}
                onClick={() => pick(template.key)}
                className='flex flex-col gap-1 rounded-lg border p-4 text-left transition-colors hover:border-primary hover:bg-muted/40 disabled:pointer-events-none disabled:opacity-50'
              >
                <span className='font-medium text-sm'>{template.name}</span>
                <span className='text-muted-foreground text-xs'>
                  {template.description}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
