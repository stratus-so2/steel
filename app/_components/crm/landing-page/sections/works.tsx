'use client'

import { Add01Icon, Delete02Icon } from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { GhostImage } from '@/components/ui/ghost-image'
import { GhostInput } from '@/components/ui/ghost-input'
import { GhostTextarea } from '@/components/ui/ghost-textarea'
import { notify } from '@/lib/notify'
import { uploadCrmLandingPageImage } from '@/src/hooks/use-crm-landing-page'
import type { CrmLandingPageSectionContent } from '@/src/schemas/crm-landing-page-section.schema'
import type { LandingPageSectionProps } from './types'

type WorksContent = Extract<CrmLandingPageSectionContent, { type: 'WORKS' }>

export function worksDefaultContent(): WorksContent {
  return { type: 'WORKS', title: 'Nossos projetos', items: [] }
}

export function WorksSection({
  content,
  onChange,
  workspaceId,
  readOnly,
}: LandingPageSectionProps<WorksContent>) {
  function updateItem(
    index: number,
    patch: Partial<{ title: string; category: string; imageUrl?: string }>,
  ) {
    onChange({
      ...content,
      items: content.items.map((it, i) =>
        i === index ? { ...it, ...patch } : it,
      ),
    })
  }

  async function handleImage(index: number, file: File) {
    const res = await uploadCrmLandingPageImage(workspaceId, file)
    if (!res.ok || !res.data) {
      notify.error(res.message ?? 'Não foi possível enviar a imagem.')
      return
    }
    updateItem(index, { imageUrl: res.data.url })
  }

  function addItem() {
    onChange({
      ...content,
      items: [...content.items, { title: 'Novo projeto', category: '' }],
    })
  }

  function removeItem(index: number) {
    onChange({ ...content, items: content.items.filter((_, i) => i !== index) })
  }

  return (
    <section className='flex flex-col items-center gap-10 px-6 py-16 sm:px-12'>
      <div className='flex max-w-xl flex-col items-center gap-3 text-center'>
        <GhostInput
          as='h2'
          value={content.title}
          onCommit={(v) => onChange({ ...content, title: v })}
          placeholder='Título da seção'
          readOnly={readOnly}
          className='font-semibold text-2xl tracking-tight sm:text-3xl'
        />
        {content.subtitle || !readOnly ? (
          <GhostTextarea
            value={content.subtitle ?? ''}
            onCommit={(v) => onChange({ ...content, subtitle: v || undefined })}
            placeholder='Descrição de apoio'
            readOnly={readOnly}
            as='p'
            className='text-balance text-muted-foreground text-sm sm:text-base'
          />
        ) : null}
      </div>

      <div className='grid w-full max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2'>
        {content.items.map((item, index) => (
          <div key={index} className='group/item relative flex flex-col gap-2'>
            {!readOnly ? (
              <Button
                type='button'
                variant='secondary'
                size='icon-xs'
                className='absolute top-2 right-2 z-10 opacity-0 group-hover/item:opacity-100'
                aria-label='Remover projeto'
                onClick={() => removeItem(index)}
              >
                <SteelIcon icon={Delete02Icon} strokeWidth={2} size={14} />
              </Button>
            ) : null}
            <GhostImage
              value={item.imageUrl}
              onUpload={(file) => handleImage(index, file)}
              readOnly={readOnly}
              alt={item.title}
              className='aspect-4/3 w-full rounded-xl'
            />
            <GhostInput
              value={item.category}
              onCommit={(v) => updateItem(index, { category: v })}
              placeholder='Categoria'
              readOnly={readOnly}
              className='text-muted-foreground text-xs'
            />
            <GhostInput
              value={item.title}
              onCommit={(v) => updateItem(index, { title: v })}
              placeholder='Título do projeto'
              readOnly={readOnly}
              className='font-medium text-base'
            />
          </div>
        ))}
        {!readOnly ? (
          <button
            type='button'
            onClick={addItem}
            className='flex min-h-40 flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-muted-foreground text-sm hover:bg-muted/40'
          >
            <SteelIcon icon={Add01Icon} strokeWidth={2} />
            Adicionar projeto
          </button>
        ) : null}
      </div>
    </section>
  )
}
