'use client'

import {
  ArrowTurnBackwardIcon,
  Clock01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { type ReactNode, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { WhiteboardVersionSummaryDTO } from '@/types/whiteboard'
import { relativeTime, VERSION_KIND_LABEL } from './whiteboard-format'

/**
 * The "Histórico" list of a board: every version (who, when, kind), a
 * preview of the selected one and "Restaurar" — which adds a version, it
 * never removes one.
 */
export function WhiteboardHistoryPanel({
  versions,
  isLoading,
  canRestore,
  restoreBlockedReason,
  selectedId,
  onSelect,
  onRestore,
  restoring,
  preview,
}: {
  versions: WhiteboardVersionSummaryDTO[] | undefined
  isLoading: boolean
  /** Editors only (and not while another member holds the lease). */
  canRestore: boolean
  restoreBlockedReason?: string | null
  selectedId: string | null
  onSelect: (versionId: string | null) => void
  onRestore: (version: WhiteboardVersionSummaryDTO) => void
  restoring: boolean
  /** Rendered preview of the selected version. */
  preview?: ReactNode
}) {
  const [confirming, setConfirming] =
    useState<WhiteboardVersionSummaryDTO | null>(null)
  const selected = versions?.find((version) => version.id === selectedId)

  if (isLoading) {
    return (
      <div
        role='status'
        aria-label='Carregando histórico'
        className='space-y-2'
      >
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className='h-14 w-full' />
        ))}
      </div>
    )
  }

  if (!versions?.length) {
    return (
      <p className='text-muted-foreground text-sm'>
        Nenhuma versão ainda. O quadro guarda uma versão automática a cada 10
        minutos de edição; use “Salvar versão” para marcar um ponto.
      </p>
    )
  }

  return (
    <div className='space-y-3'>
      {selected && (
        <div className='space-y-2 rounded-lg border p-2'>
          <div className='flex aspect-video items-center justify-center overflow-hidden rounded bg-background [&_svg]:h-full [&_svg]:w-full'>
            {preview}
          </div>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <Button variant='ghost' size='sm' onClick={() => onSelect(null)}>
              Fechar prévia
            </Button>
            {canRestore ? (
              <Button
                size='sm'
                disabled={restoring}
                onClick={() => setConfirming(selected)}
              >
                <SteelIcon icon={ArrowTurnBackwardIcon} strokeWidth={2} />
                Restaurar esta versão
              </Button>
            ) : restoreBlockedReason ? (
              <span className='text-muted-foreground text-xs'>
                {restoreBlockedReason}
              </span>
            ) : null}
          </div>
        </div>
      )}
      <ol aria-label='Versões' className='space-y-1'>
        {versions.map((version) => (
          <li key={version.id}>
            <button
              type='button'
              aria-pressed={version.id === selectedId}
              onClick={() =>
                onSelect(version.id === selectedId ? null : version.id)
              }
              className={cn(
                'flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted',
                version.id === selectedId && 'bg-muted',
              )}
            >
              <SteelIcon
                icon={Clock01Icon}
                size={16}
                className='mt-0.5 shrink-0 text-muted-foreground'
              />
              <span className='min-w-0 flex-1 space-y-0.5'>
                <span className='flex flex-wrap items-center gap-1.5'>
                  <span className='truncate font-medium text-sm'>
                    {version.name ?? relativeTime(version.createdAt)}
                  </span>
                  <Badge variant='secondary'>
                    {VERSION_KIND_LABEL[version.kind]}
                  </Badge>
                </span>
                <span className='block truncate text-muted-foreground text-xs'>
                  {[
                    version.name ? relativeTime(version.createdAt) : null,
                    version.createdBy?.name,
                    version.elementCount === 1
                      ? '1 elemento'
                      : `${version.elementCount} elementos`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ol>
      <AlertDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar esta versão?</AlertDialogTitle>
            <AlertDialogDescription>
              O quadro volta a este ponto. Nada se perde: o estado atual fica
              guardado no histórico e a restauração vira uma nova versão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              onClick={() => {
                if (confirming) onRestore(confirming)
                setConfirming(null)
              }}
            >
              Restaurar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
