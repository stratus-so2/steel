'use client'

import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  ViewIcon,
  ViewOffIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { EmailBrand } from '@/src/lib/crm-email-builder/brand'
import {
  canMoveSection,
  getLayoutSection,
  SECTION_TYPE_LABEL,
} from '@/src/lib/crm-email-builder/layouts'
import type {
  EmailBuilderDocument,
  EmailBuilderSection,
} from '@/src/schemas/crm-email-builder.schema'
import { BrandForm } from './brand-form'
import { SectionFields } from './section-fields'

export type PanelTab = 'content' | 'sections' | 'brand'

function sectionLabel(
  document: EmailBuilderDocument,
  section: EmailBuilderSection,
) {
  return (
    getLayoutSection(document.layout, section.id)?.label ??
    SECTION_TYPE_LABEL[section.type]
  )
}

function SectionActions({
  document,
  section,
  onToggleHidden,
  onMove,
}: {
  document: EmailBuilderDocument
  section: EmailBuilderSection
  onToggleHidden: (id: string) => void
  onMove: (id: string, direction: -1 | 1) => void
}) {
  const entry = getLayoutSection(document.layout, section.id)
  const label = sectionLabel(document, section)
  return (
    <div className='flex shrink-0 items-center gap-0.5'>
      {entry?.movable ? (
        <>
          <Button
            type='button'
            size='icon-sm'
            variant='ghost'
            aria-label={`Mover ${label} para cima`}
            disabled={!canMoveSection(document, section.id, -1)}
            onClick={() => onMove(section.id, -1)}
          >
            <SteelIcon icon={ArrowUp01Icon} strokeWidth={2} />
          </Button>
          <Button
            type='button'
            size='icon-sm'
            variant='ghost'
            aria-label={`Mover ${label} para baixo`}
            disabled={!canMoveSection(document, section.id, 1)}
            onClick={() => onMove(section.id, 1)}
          >
            <SteelIcon icon={ArrowDown01Icon} strokeWidth={2} />
          </Button>
        </>
      ) : null}
      {entry?.optional ? (
        <Button
          type='button'
          size='icon-sm'
          variant='ghost'
          aria-label={section.hidden ? `Mostrar ${label}` : `Ocultar ${label}`}
          aria-pressed={section.hidden}
          onClick={() => onToggleHidden(section.id)}
        >
          <SteelIcon
            icon={section.hidden ? ViewOffIcon : ViewIcon}
            strokeWidth={2}
          />
        </Button>
      ) : null}
    </div>
  )
}

/**
 * Bottom panel of the builder (Storybook "controls" style): the content of
 * the selected block, the section list (show/hide, reorder) and the brand.
 */
export function EmailBuilderPanel({
  workspaceId,
  document,
  selectedId,
  tab,
  onTabChange,
  onSelect,
  onSectionChange,
  onToggleHidden,
  onMove,
  brand,
  brandSaving,
  onBrandPreview,
  onBrandSave,
}: {
  workspaceId: string
  document: EmailBuilderDocument
  selectedId: string | null
  tab: PanelTab
  onTabChange: (tab: PanelTab) => void
  onSelect: (id: string) => void
  onSectionChange: (
    id: string,
    props: Record<string, unknown>,
    group: string,
  ) => void
  onToggleHidden: (id: string) => void
  onMove: (id: string, direction: -1 | 1) => void
  brand: EmailBrand
  brandSaving: boolean
  onBrandPreview: (brand: EmailBrand) => void
  onBrandSave: (brand: EmailBrand) => Promise<void>
}) {
  const selected = document.sections.find((s) => s.id === selectedId) ?? null

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => onTabChange(value as PanelTab)}
      className='flex h-full min-h-0 flex-col gap-0'
    >
      <div className='flex shrink-0 items-center gap-2 overflow-x-auto border-b px-3 py-2'>
        <TabsList>
          <TabsTrigger value='content'>Conteúdo</TabsTrigger>
          <TabsTrigger value='sections'>Seções</TabsTrigger>
          <TabsTrigger value='brand'>Marca</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent
        value='content'
        className='min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4'
      >
        {selected ? (
          <div className='mx-auto grid max-w-4xl gap-4'>
            <div className='flex items-center justify-between gap-2'>
              <div className='min-w-0'>
                <h2 className='truncate font-semibold text-sm'>
                  {sectionLabel(document, selected)}
                </h2>
                {selected.hidden ? (
                  <p className='text-muted-foreground text-xs'>
                    Seção oculta — não vai no e-mail.
                  </p>
                ) : null}
              </div>
              <SectionActions
                document={document}
                section={selected}
                onToggleHidden={onToggleHidden}
                onMove={onMove}
              />
            </div>
            <SectionFields
              key={selected.id}
              section={selected}
              workspaceId={workspaceId}
              onChange={(props, group) =>
                onSectionChange(selected.id, props, group)
              }
            />
          </div>
        ) : (
          <p className='py-6 text-center text-muted-foreground text-sm'>
            Clique em um bloco do e-mail para editar o conteúdo.
          </p>
        )}
      </TabsContent>

      <TabsContent
        value='sections'
        className='min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4'
      >
        <ul className='mx-auto grid max-w-2xl gap-1'>
          {document.sections.map((section) => (
            <li
              key={section.id}
              className={cn(
                'flex items-center gap-2 rounded-md border border-transparent px-2 py-1',
                section.id === selectedId && 'border-border bg-muted/60',
              )}
            >
              <button
                type='button'
                className={cn(
                  'min-w-0 flex-1 truncate text-left text-sm',
                  section.hidden && 'text-muted-foreground line-through',
                )}
                onClick={() => onSelect(section.id)}
              >
                {sectionLabel(document, section)}
              </button>
              <SectionActions
                document={document}
                section={section}
                onToggleHidden={onToggleHidden}
                onMove={onMove}
              />
            </li>
          ))}
        </ul>
        <p className='mx-auto mt-3 max-w-2xl text-muted-foreground text-xs'>
          A estrutura do modelo é fixa: dá para ocultar as seções opcionais e
          trocar a ordem das que têm setas.
        </p>
      </TabsContent>

      <TabsContent
        value='brand'
        className='min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4'
      >
        <div className='mx-auto max-w-3xl'>
          <BrandForm
            workspaceId={workspaceId}
            brand={brand}
            saving={brandSaving}
            onPreview={onBrandPreview}
            onSave={onBrandSave}
          />
        </div>
      </TabsContent>
    </Tabs>
  )
}
