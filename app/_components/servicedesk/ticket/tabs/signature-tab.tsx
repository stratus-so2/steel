'use client'

import { SignatureIcon } from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { notify } from '@/lib/notify'
import {
  useCreateSdTicketSignature,
  useSdTicketSignatures,
} from '@/src/hooks/use-sd-ticket-signatures'
import { useSdTicketRealtime } from '@/src/hooks/use-sd-tickets'
import { EmptyState, FieldBlock } from '../../settings/sd-settings-kit'
import { SdSignatureCard } from '../signature/sd-signature-card'
import { SdSignaturePad } from '../signature/sd-signature-pad'
import type { SdTicketTabProps } from './types'

const DEFAULT_PURPOSE = 'Aceite do atendimento'

/**
 * Assinatura digital: quadro de assinatura + dados de quem assina. O PNG e o
 * snapshot do chamado ganham SHA-256 no servidor; a lista permite conferir a
 * integridade. Agentes e solicitantes (portal) podem assinar.
 */
export function SdTicketSignatureTab({
  workspaceId,
  ticket,
}: SdTicketTabProps) {
  const ticketRef = ticket.id
  useSdTicketRealtime(workspaceId)
  const query = useSdTicketSignatures(workspaceId, ticketRef)
  const create = useCreateSdTicketSignature(workspaceId, ticketRef)
  const [signerName, setSignerName] = useState('')
  const [signerDocument, setSignerDocument] = useState('')
  const [signerEmail, setSignerEmail] = useState('')
  const [purpose, setPurpose] = useState(DEFAULT_PURPOSE)
  const [image, setImage] = useState<string | null>(null)
  const [padKey, setPadKey] = useState(0)

  const valid = signerName.trim().length >= 2 && image !== null
  const items = query.data ?? []

  async function submit() {
    if (!valid || !image) return
    try {
      await create.mutateAsync({
        signerName: signerName.trim(),
        signerDocument: signerDocument.trim() || null,
        signerEmail: signerEmail.trim() || null,
        purpose: purpose.trim() || DEFAULT_PURPOSE,
        image,
      })
      notify.success('Assinatura registrada')
      setSignerName('')
      setSignerDocument('')
      setSignerEmail('')
      setPurpose(DEFAULT_PURPOSE)
      setImage(null)
      setPadKey((k) => k + 1)
    } catch (error) {
      notify.error(error)
    }
  }

  return (
    <div className='flex flex-col gap-5 p-4'>
      <form
        className='flex flex-col gap-3 rounded-lg border border-border p-4'
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <h3 className='flex items-center gap-2 font-medium text-sm'>
          <SteelIcon icon={SignatureIcon} />
          Colher assinatura
        </h3>
        <div className='grid gap-3 sm:grid-cols-2'>
          <FieldBlock label='Nome de quem assina'>
            <Input
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              aria-label='Nome de quem assina'
            />
          </FieldBlock>
          <FieldBlock label='Documento (CPF/RG)'>
            <Input
              value={signerDocument}
              onChange={(e) => setSignerDocument(e.target.value)}
              aria-label='Documento'
            />
          </FieldBlock>
          <FieldBlock label='E-mail'>
            <Input
              type='email'
              value={signerEmail}
              onChange={(e) => setSignerEmail(e.target.value)}
              aria-label='E-mail de quem assina'
            />
          </FieldBlock>
          <FieldBlock label='Finalidade'>
            <Input
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              aria-label='Finalidade'
            />
          </FieldBlock>
        </div>
        <SdSignaturePad
          key={padKey}
          onChange={setImage}
          disabled={create.isPending}
        />
        <p className='text-muted-foreground text-xs'>
          Ao assinar, registramos o SHA-256 da imagem e do estado atual do
          chamado para conferência de integridade.
        </p>
        <div className='flex justify-end'>
          <Button type='submit' disabled={!valid || create.isPending}>
            Registrar assinatura
          </Button>
        </div>
      </form>

      <div className='flex flex-col gap-2'>
        <h3 className='font-medium text-sm'>Assinaturas registradas</h3>
        {query.error ? (
          <EmptyState>{query.error.message}</EmptyState>
        ) : !query.isLoading && items.length === 0 ? (
          <EmptyState>Nenhuma assinatura neste chamado.</EmptyState>
        ) : (
          <ul className='flex flex-col gap-2'>
            {items.map((signature) => (
              <SdSignatureCard
                key={signature.id}
                workspaceId={workspaceId}
                ticketRef={ticketRef}
                signature={signature}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
