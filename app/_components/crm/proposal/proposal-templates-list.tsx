'use client'

import { Add01Icon, Delete02Icon } from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { notify } from '@/lib/notify'
import {
  deleteCrmProposalTemplate,
  useCrmProposalTemplates,
} from '@/src/hooks/use-crm-proposal-template'

export function ProposalTemplatesList({
  workspaceId,
  slug,
}: {
  workspaceId: string
  slug: string
}) {
  const { templates, isLoading, refetch } = useCrmProposalTemplates(workspaceId)

  async function handleDelete(id: string) {
    const res = await deleteCrmProposalTemplate(workspaceId, id)
    if (res.ok) {
      notify.success('Template removido.')
      refetch()
    } else {
      notify.error(res.message ?? 'Não foi possível remover o template.')
    }
  }

  return (
    <div className='flex h-full flex-col gap-4 p-4'>
      <div className='flex items-center justify-between'>
        <p className='text-muted-foreground text-sm'>
          Templates definem quais seções vêm habilitadas e o conteúdo padrão ao
          criar uma nova proposta.
        </p>
        <Button
          size='sm'
          render={<Link href={`/${slug}/crm/proposal-templates/new`} />}
        >
          <SteelIcon icon={Add01Icon} strokeWidth={2} />
          Novo template
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className='h-32 w-full' />
      ) : templates.length === 0 ? (
        <p className='py-12 text-center text-muted-foreground text-sm'>
          Nenhum template ainda. Crie um do zero ou salve uma proposta existente
          como template.
        </p>
      ) : (
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          {templates.map((template) => (
            <div
              key={template.id}
              className='flex flex-col gap-2 rounded-lg border p-4'
            >
              <Link
                href={`/${slug}/crm/proposal-templates/${template.id}`}
                className='font-medium hover:underline'
              >
                {template.name}
              </Link>
              {template.description ? (
                <p className='line-clamp-2 text-muted-foreground text-sm'>
                  {template.description}
                </p>
              ) : null}
              <p className='text-muted-foreground text-xs'>
                {template.sections.filter((s) => s.enabled).length} seções
                habilitadas
              </p>
              <Button
                variant='ghost'
                size='sm'
                className='w-fit text-destructive hover:text-destructive'
                onClick={() => handleDelete(template.id)}
              >
                <SteelIcon icon={Delete02Icon} strokeWidth={2} />
                Remover
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
