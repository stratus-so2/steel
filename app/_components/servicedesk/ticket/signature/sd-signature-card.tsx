'use client'

import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  Copy01Icon,
  Shield01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import { useVerifySdTicketSignature } from '@/src/hooks/use-sd-ticket-signatures'
import type {
  SdTicketSignatureDTO,
  SdTicketSignatureVerificationDTO,
} from '@/types/sd-ticket-signature'
import { formatDateTime } from '../shared/sd-tab-format'

function HashLine({ label, hash }: { label: string; hash: string }) {
  return (
    <div className='flex items-center gap-1.5 text-xs'>
      <span className='text-muted-foreground'>{label}</span>
      <code className='font-mono' title={hash}>
        {hash.slice(0, 12)}…{hash.slice(-6)}
      </code>
      <button
        type='button'
        aria-label={`Copiar ${label}`}
        className='text-muted-foreground hover:text-foreground'
        onClick={() => {
          void navigator.clipboard
            ?.writeText(hash)
            .then(() => notify.success('Hash copiado'))
            .catch(() => notify.error('Não foi possível copiar'))
        }}
      >
        <SteelIcon icon={Copy01Icon} size={12} />
      </button>
    </div>
  )
}

function Verdict({ result }: { result: SdTicketSignatureVerificationDTO }) {
  return (
    <div className='flex flex-col gap-1 rounded-md bg-muted/50 p-2 text-xs'>
      <span
        className={cn(
          'flex items-center gap-1.5 font-medium',
          result.imageIntact
            ? 'text-emerald-700 dark:text-emerald-400'
            : 'text-destructive',
        )}
      >
        <SteelIcon
          icon={result.imageIntact ? CheckmarkCircle02Icon : Alert02Icon}
          size={14}
        />
        {result.imageIntact
          ? 'Imagem íntegra'
          : result.computedImageSha256
            ? 'Imagem adulterada (hash diferente)'
            : 'Arquivo da assinatura não encontrado'}
      </span>
      <span
        className={cn(
          'flex items-center gap-1.5',
          result.ticketUnchanged
            ? 'text-emerald-700 dark:text-emerald-400'
            : 'text-amber-700 dark:text-amber-400',
        )}
      >
        <SteelIcon
          icon={result.ticketUnchanged ? CheckmarkCircle02Icon : Alert02Icon}
          size={14}
        />
        {result.ticketUnchanged
          ? 'Chamado sem alterações desde a assinatura'
          : 'Chamado alterado desde a assinatura'}
      </span>
      <span className='text-muted-foreground'>
        Verificado em {formatDateTime(result.verifiedAt)}
      </span>
    </div>
  )
}

export function SdSignatureCard({
  workspaceId,
  ticketRef,
  signature,
}: {
  workspaceId: string
  ticketRef: string
  signature: SdTicketSignatureDTO
}) {
  const verify = useVerifySdTicketSignature(workspaceId, ticketRef)
  const [result, setResult] = useState<SdTicketSignatureVerificationDTO | null>(
    null,
  )

  return (
    <li
      className='flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row'
      data-testid='sd-signature'
    >
      <div className='w-full shrink-0 overflow-hidden rounded-md border border-border bg-white sm:w-56'>
        <img
          src={signature.imageUrl}
          alt={`Assinatura de ${signature.signerName}`}
          className='h-28 w-full object-contain'
          loading='lazy'
        />
      </div>
      <div className='flex min-w-0 flex-1 flex-col gap-1.5'>
        <div>
          <div className='font-medium text-sm'>{signature.signerName}</div>
          <div className='text-muted-foreground text-xs'>
            {[signature.signerDocument, signature.signerEmail]
              .filter(Boolean)
              .join(' · ') || 'Sem documento informado'}
          </div>
        </div>
        <div className='text-xs'>
          <span className='text-muted-foreground'>Finalidade: </span>
          {signature.purpose}
        </div>
        <div className='text-muted-foreground text-xs'>
          Assinado em {formatDateTime(signature.signedAt)}
          {signature.signedBy
            ? ` · registrado por ${signature.signedBy.name}`
            : ''}
        </div>
        <HashLine label='SHA-256 da imagem' hash={signature.imageSha256} />
        <HashLine label='SHA-256 do chamado' hash={signature.ticketSha256} />
        {result ? <Verdict result={result} /> : null}
        <div>
          <Button
            type='button'
            size='xs'
            variant='outline'
            disabled={verify.isPending}
            onClick={() =>
              verify.mutate(signature.id, {
                onSuccess: setResult,
                onError: (error) => notify.error(error),
              })
            }
          >
            <SteelIcon icon={Shield01Icon} />
            Verificar integridade
          </Button>
        </div>
      </div>
    </li>
  )
}
