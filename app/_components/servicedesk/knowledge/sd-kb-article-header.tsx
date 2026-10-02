'use client'

import {
  ArrowLeft01Icon,
  BookOpen01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { HeaderBreadcrumbCrumb } from '@/app/_components/header/breadcrumb-page/header-breadcrumb-crumb'
import { HeaderBreadcrumbList } from '@/app/_components/header/breadcrumb-page/header-breadcrumb-page'
import HeaderInternalNavigation from '@/app/_components/header/header-internal-navigation'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'

/**
 * Article page header: **only the house standard** — a `<` back button and the
 * `Base de conhecimento > [document name]` breadcrumb.
 *
 * There used to be two stacked headers: the layout one, with a fixed
 * "Base de conhecimento" crumb that never said which document was open and
 * offered no way back, and right below it a second 44px bar from the editor
 * holding the badges and the buttons. Now it is a single row: the editor
 * actions go on the right of this same bar, through the `actions` slot.
 */
export function SdKbArticleHeader({
  workspaceSlug,
  title,
  actions,
}: {
  workspaceSlug: string
  /** Document name; empty on a freshly created article. */
  title: string
  actions?: ReactNode
}) {
  const home = `/${workspaceSlug}/servicedesk/knowledge`
  return (
    <HeaderInternalNavigation>
      <div className='flex min-w-0 items-center gap-1.5'>
        <Button
          variant='ghost'
          size='icon-xs'
          aria-label='Voltar para a base de conhecimento'
          render={<Link href={home} />}
        >
          <SteelIcon icon={ArrowLeft01Icon} strokeWidth={2} />
        </Button>
        <HeaderBreadcrumbList>
          <HeaderBreadcrumbCrumb title='Base de conhecimento'>
            <SteelIcon
              icon={BookOpen01Icon}
              strokeWidth={2}
              className='text-primary'
            />
          </HeaderBreadcrumbCrumb>
          <HeaderBreadcrumbCrumb title={title.trim() || 'Sem título'}>
            {null}
          </HeaderBreadcrumbCrumb>
        </HeaderBreadcrumbList>
      </div>
      {actions ? (
        <div className='flex shrink-0 items-center gap-1'>{actions}</div>
      ) : null}
    </HeaderInternalNavigation>
  )
}
