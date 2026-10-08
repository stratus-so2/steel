'use client'

import { BrainIcon } from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { isApiErrorCode } from '@/src/hooks/_fetch'
import { useDeleteAiMemory } from '@/src/hooks/use-ai-memory'
import type { AiMemoryRefDTO } from '@/types/ai-memory'

const TITLE: Record<AiMemoryRefDTO['action'], string> = {
  saved: 'Memória salva',
  duplicate: 'Já estava na memória',
  forgotten: 'Memória esquecida',
}

/**
 * Transcript chip of a memory tool: what Steel AI saved (or forgot), with
 * "Desfazer" for a new fact — it was saved without confirmation, so undoing
 * must be one click away.
 */
export function SteelAiMemoryChip({
  workspaceId,
  memory,
}: {
  workspaceId: string
  memory: AiMemoryRefDTO
}) {
  const remove = useDeleteAiMemory(workspaceId)
  const [state, setState] = useState<'idle' | 'undone' | 'error'>('idle')
  const undoable = memory.action === 'saved'

  async function undo() {
    try {
      await remove.mutateAsync(memory.id)
      setState('undone')
    } catch (error) {
      // Already gone (deleted in the Memória tab) counts as undone.
      setState(
        isApiErrorCode(error, 'AI_MEMORY_NOT_FOUND') ? 'undone' : 'error',
      )
    }
  }

  return (
    <li
      className='flex min-w-0 max-w-full items-start gap-1.5 rounded-lg border border-border/80 bg-background px-2.5 py-1 text-xs leading-relaxed'
      data-memory-action={memory.action}
    >
      <SteelIcon
        icon={BrainIcon}
        strokeWidth={2}
        aria-hidden
        className='mt-0.5 size-3.5 shrink-0 text-primary'
      />
      <span className='min-w-0 break-words'>
        <span className='font-medium text-foreground'>
          {state === 'undone' ? 'Memória desfeita' : TITLE[memory.action]}
          {memory.scope === 'WORKSPACE' ? ' (workspace)' : ''}
        </span>
        <span
          className={
            state === 'undone'
              ? 'text-muted-foreground line-through'
              : 'text-muted-foreground'
          }
        >
          {' '}
          — {memory.content}
        </span>
        {state === 'error' ? (
          <span className='text-destructive'> · Não foi possível desfazer</span>
        ) : null}
      </span>
      {undoable && state !== 'undone' ? (
        <button
          type='button'
          onClick={undo}
          disabled={remove.isPending}
          className='shrink-0 font-medium text-primary underline-offset-2 hover:underline disabled:opacity-50'
        >
          Desfazer
        </button>
      ) : null}
    </li>
  )
}
