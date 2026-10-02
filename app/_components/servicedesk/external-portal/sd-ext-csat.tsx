'use client'

import { StarIcon } from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useRateSdPortalTicket } from '@/src/hooks/use-sd-external-portal'
import { SD_CSAT_STAR_HOVER, SD_CSAT_STAR_ON } from '../portal/sd-portal-tone'

const SCORES = [1, 2, 3, 4, 5] as const

export const SD_EXT_CSAT_LABEL: Record<number, string> = {
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
      {SCORES.map((score) => {
        const filled = score <= value
        const label = `${score} ${score === 1 ? 'estrela' : 'estrelas'} — ${SD_EXT_CSAT_LABEL[score]}`
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
              filled ? SD_CSAT_STAR_ON : 'text-muted-foreground',
              !disabled && SD_CSAT_STAR_HOVER,
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
 * Avaliação do atendimento no portal externo: 1 a 5 estrelas e um
 * comentário opcional, uma única vez. Já avaliado, mostra a nota.
 */
export function SdExtCsat({
  code,
  csatScore,
  csatComment,
  canRate,
}: {
  code: string
  csatScore: number | null
  csatComment: string | null
  canRate: boolean
}) {
  const rate = useRateSdPortalTicket(code)
  const [score, setScore] = useState(0)
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (csatScore !== null) {
    return (
      <section className='flex flex-col gap-2 rounded-xl border border-border bg-muted p-4'>
        <h2 className='font-medium text-sm'>Obrigado pela sua avaliação!</h2>
        <Stars value={csatScore} disabled />
        <p className='text-muted-foreground text-xs'>
          Você avaliou este atendimento como "{SD_EXT_CSAT_LABEL[csatScore]}".
        </p>
        {csatComment ? <p className='text-sm italic'>“{csatComment}”</p> : null}
      </section>
    )
  }

  if (!canRate) return null

  async function send() {
    if (score < 1) return
    setError(null)
    try {
      await rate.mutateAsync({
        score,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      })
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não conseguimos registrar sua avaliação',
      )
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
      <Stars value={score} onChange={setScore} disabled={rate.isPending} />
      <Textarea
        rows={3}
        maxLength={2000}
        value={comment}
        aria-label='Comentário sobre o atendimento'
        placeholder='Quer contar mais alguma coisa? (opcional)'
        onChange={(event) => setComment(event.target.value)}
      />
      {error ? (
        <p role='alert' className='text-destructive text-xs'>
          {error}
        </p>
      ) : null}
      <div className='flex justify-end'>
        <Button
          type='button'
          disabled={score < 1 || rate.isPending}
          onClick={() => void send()}
        >
          {rate.isPending ? 'Enviando…' : 'Enviar avaliação'}
        </Button>
      </div>
    </section>
  )
}
