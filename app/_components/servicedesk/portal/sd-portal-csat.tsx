'use client'

import { StarIcon } from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import { useSubmitSdTicketCsat } from '@/src/hooks/use-sd-portal'

export const SD_CSAT_SCORES = [1, 2, 3, 4, 5] as const

/** Rótulo de cada nota (o solicitante vê isto, não "CSAT"). */
export const SD_CSAT_LABEL: Record<number, string> = {
  1: 'Muito ruim',
  2: 'Ruim',
  3: 'Regular',
  4: 'Bom',
  5: 'Excelente',
}

function Stars({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange?: (score: number) => void
  disabled?: boolean
}) {
  return (
    <div className='flex items-center gap-1'>
      {SD_CSAT_SCORES.map((score) => {
        const filled = score <= value
        const label = `${score} ${score === 1 ? 'estrela' : 'estrelas'} — ${SD_CSAT_LABEL[score]}`
        return (
          <button
            key={score}
            type='button'
            aria-label={label}
            title={label}
            aria-pressed={filled}
            disabled={disabled}
            onClick={() => onChange?.(score)}
            className={cn(
              'rounded p-1 transition-colors',
              filled ? 'text-amber-500' : 'text-muted-foreground',
              !disabled && 'hover:text-amber-500',
            )}
          >
            <SteelIcon
              icon={StarIcon}
              strokeWidth={filled ? 2.4 : 1.6}
              className='size-6'
            />
          </button>
        )
      })}
    </div>
  )
}

/**
 * Avaliação do atendimento no portal: 1 a 5 estrelas e um comentário
 * opcional, uma única vez. Já avaliado, mostra a nota registrada.
 */
export function SdPortalCsat({
  workspaceId,
  ticketRef,
  csatScore,
  csatComment,
}: {
  workspaceId: string
  ticketRef: string
  csatScore: number | null
  csatComment: string | null
}) {
  const submit = useSubmitSdTicketCsat(workspaceId, ticketRef)
  const [score, setScore] = useState(0)
  const [comment, setComment] = useState('')

  if (csatScore !== null) {
    return (
      <section className='flex flex-col gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4'>
        <h2 className='font-medium text-amber-700 text-sm dark:text-amber-300'>
          Obrigado pela sua avaliação!
        </h2>
        <Stars value={csatScore} disabled />
        <p className='text-muted-foreground text-xs'>
          Você avaliou este atendimento como "{SD_CSAT_LABEL[csatScore]}".
        </p>
        {csatComment ? <p className='text-sm italic'>“{csatComment}”</p> : null}
      </section>
    )
  }

  async function send() {
    if (score < 1) return
    try {
      await submit.mutateAsync({
        score,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      })
      notify.success('Obrigado! Sua avaliação foi registrada.')
    } catch (error) {
      notify.error(error)
    }
  }

  return (
    <section className='flex flex-col gap-3 rounded-xl border border-border bg-card p-4'>
      <div>
        <h2 className='font-medium text-sm'>Como foi o atendimento?</h2>
        <p className='text-muted-foreground text-xs'>
          Sua resposta ajuda a equipe a melhorar. Leva 10 segundos.
        </p>
      </div>
      <Stars value={score} onChange={setScore} disabled={submit.isPending} />
      <Textarea
        rows={3}
        maxLength={2000}
        value={comment}
        aria-label='Comentário sobre o atendimento'
        placeholder='Quer contar mais alguma coisa? (opcional)'
        onChange={(event) => setComment(event.target.value)}
      />
      <div className='flex justify-end'>
        <Button
          type='button'
          disabled={score < 1 || submit.isPending}
          onClick={() => void send()}
        >
          {submit.isPending ? 'Enviando…' : 'Enviar avaliação'}
        </Button>
      </div>
    </section>
  )
}
