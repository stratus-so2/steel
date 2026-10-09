'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { notify } from '@/lib/notify'
import {
  useCreateCrmEmailBuilderTemplate,
  useCrmEmailBrand,
} from '@/src/hooks/use-crm-email-builder'
import {
  DEFAULT_PRIMARY_COLOR,
  type EmailBrand,
} from '@/src/lib/crm-email-builder/brand'
import {
  createBuilderDocument,
  EMAIL_LAYOUT_LIST,
  type EmailLayout,
} from '@/src/lib/crm-email-builder/layouts'
import {
  personalizeEmail,
  renderBuilderEmail,
} from '@/src/lib/crm-email-builder/render'
import {
  contactToVariables,
  SAMPLE_CONTACT,
} from '@/src/lib/crm-email-builder/variables'

// The e-mail body plus canvas padding; the thumbnail scales it to the card.
const THUMB_WIDTH = 640
const THUMB_HEIGHT = 760
const THUMB_DEFAULT_SCALE = 0.4

/** Static, non-interactive thumbnail of a layout with the workspace brand. */
function LayoutThumbnail({
  layout,
  brand,
}: {
  layout: EmailLayout
  brand: EmailBrand
}) {
  const [html, setHtml] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(THUMB_DEFAULT_SCALE)

  useEffect(() => {
    const node = boxRef.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) {
        setScale(entry.contentRect.width / THUMB_WIDTH)
      }
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    renderBuilderEmail(createBuilderDocument(layout.id), brand, {
      subject: layout.defaultSubject,
    }).then((rendered) => {
      const email = personalizeEmail(
        rendered,
        contactToVariables(SAMPLE_CONTACT, { campaignLink: '#' }),
      )
      if (!cancelled) setHtml(email.html)
    })
    return () => {
      cancelled = true
    }
  }, [layout, brand])

  return (
    <div
      ref={boxRef}
      className='relative w-full overflow-hidden rounded-t-lg border-b bg-muted/40'
      style={{ height: Math.min(THUMB_HEIGHT * scale, 360) }}
    >
      {html ? (
        <iframe
          title={`Miniatura: ${layout.label}`}
          srcDoc={html}
          sandbox=''
          tabIndex={-1}
          aria-hidden='true'
          className='pointer-events-none absolute top-0 left-0 border-0'
          style={{
            width: THUMB_WIDTH,
            height: THUMB_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        />
      ) : null}
    </div>
  )
}

/**
 * Gallery of ready e-mail templates (React Email based). Picking one asks
 * for a name and subject, creates the template and opens the editor.
 */
export function EmailTemplateGallery({
  workspaceId,
  slug,
}: {
  workspaceId: string
  slug: string
}) {
  const router = useRouter()
  const { data: brandDto } = useCrmEmailBrand(workspaceId)
  const create = useCreateCrmEmailBuilderTemplate(workspaceId)
  const [chosen, setChosen] = useState<EmailLayout | null>(null)
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')

  const brand = useMemo<EmailBrand>(
    () =>
      brandDto
        ? {
            companyName: brandDto.companyName,
            logoUrl: brandDto.logoUrl,
            primaryColor: brandDto.primaryColor,
            address: brandDto.address,
            website: brandDto.website,
          }
        : {
            companyName: 'Sua empresa',
            logoUrl: '',
            primaryColor: DEFAULT_PRIMARY_COLOR,
            address: '',
            website: '',
          },
    [brandDto],
  )

  function choose(layout: EmailLayout) {
    setChosen(layout)
    setName(layout.label)
    setSubject(layout.defaultSubject)
  }

  async function handleCreate() {
    if (!chosen) return
    if (!name.trim()) {
      notify.error('Informe o nome do template')
      return
    }
    if (!subject.trim()) {
      notify.error('Informe o assunto')
      return
    }
    try {
      const template = await create.mutateAsync({
        name: name.trim(),
        subject: subject.trim(),
        builderLayout: chosen.id,
      })
      router.push(`/${slug}/crm/email-templates/${template.id}`)
    } catch (error) {
      notify.error(error)
    }
  }

  return (
    <div className='h-full overflow-y-auto overflow-x-hidden p-4'>
      <div className='mx-auto max-w-6xl'>
        <div className='mb-4'>
          <h1 className='font-semibold text-lg'>Galeria de modelos</h1>
          <p className='text-muted-foreground text-sm'>
            Escolha um modelo pronto e edite só o conteúdo — textos, imagens,
            botões e links. O visual segue a marca do workspace.
          </p>
        </div>
        <ul className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
          {EMAIL_LAYOUT_LIST.map((layout) => (
            <li
              key={layout.id}
              className='flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card'
            >
              <LayoutThumbnail layout={layout} brand={brand} />
              <div className='flex flex-1 flex-col gap-2 p-3'>
                <div className='flex items-center justify-between gap-2'>
                  <h2 className='truncate font-medium text-sm'>
                    {layout.label}
                  </h2>
                  <Badge variant='secondary'>{layout.category}</Badge>
                </div>
                <p className='flex-1 text-muted-foreground text-xs'>
                  {layout.description}
                </p>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => choose(layout)}
                  aria-label={`Usar o modelo ${layout.label}`}
                >
                  Usar modelo
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <Dialog
        open={chosen !== null}
        onOpenChange={(open) => (open ? null : setChosen(null))}
      >
        <DialogContent className='max-w-md'>
          <DialogTitle>Novo template: {chosen?.label}</DialogTitle>
          <DialogDescription>
            Dá para mudar o nome e o assunto depois, no editor.
          </DialogDescription>
          <div className='grid gap-3'>
            <div className='grid gap-1.5'>
              <Label htmlFor='gallery-name'>Nome do template</Label>
              <Input
                id='gallery-name'
                value={name}
                maxLength={200}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className='grid gap-1.5'>
              <Label htmlFor='gallery-subject'>Assunto do e-mail</Label>
              <Input
                id='gallery-subject'
                value={subject}
                maxLength={300}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
          </div>
          <div className='flex justify-end gap-2'>
            <Button variant='ghost' onClick={() => setChosen(null)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={create.isPending}>
              {create.isPending ? 'Criando…' : 'Criar e editar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
