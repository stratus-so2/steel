'use client'

import { Link04Icon, MailSend01Icon } from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import {
  useIssueSdPortalAccess,
  useRevokeSdPortalAccess,
  useSdPortalAccesses,
} from '@/src/hooks/use-sd-portal-access'
import type { SdPortalAccessDTO } from '@/types/sd-portal'
import { SD_TONE, sdFormatDateTime } from '../ticket/sd-ticket-meta'

const STATUS_LABEL: Record<SdPortalAccessDTO['status'], string> = {
  pending: 'Link enviado, ainda não usado',
  active: 'No portal agora',
  used: 'Link já usado',
  expired: 'Link expirado',
  revoked: 'Revogado',
}

const STATUS_TONE: Record<SdPortalAccessDTO['status'], string> = {
  pending: SD_TONE.sky,
  active: SD_TONE.emerald,
  used: SD_TONE.slate,
  expired: SD_TONE.amber,
  revoked: SD_TONE.red,
}

/**
 * Botão do agente para enviar ao contato o acesso ao portal externo (link
 * mágico de 7 dias, uso único) e revogar acessos já emitidos. Fica na tela
 * do contato e na do chamado.
 */
export function SdPortalAccessButton({
  workspaceId,
  contactId,
  contactEmail,
  contactName,
  variant = 'outline',
  size = 'sm',
  label = 'Enviar acesso ao portal',
}: {
  workspaceId: string
  contactId: string
  contactEmail?: string | null
  contactName?: string | null
  variant?: 'outline' | 'ghost' | 'default'
  size?: 'xs' | 'sm' | 'default'
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const accesses = useSdPortalAccesses(workspaceId, open ? contactId : null)
  const issue = useIssueSdPortalAccess(workspaceId)
  const revoke = useRevokeSdPortalAccess(workspaceId)

  const target = email.trim() || contactEmail?.trim() || ''

  async function send() {
    try {
      await issue.mutateAsync({
        contactId,
        ...(email.trim() ? { email: email.trim().toLowerCase() } : {}),
      })
      notify.success(`Acesso enviado para ${target}`)
      setEmail('')
    } catch (error) {
      notify.error(error)
    }
  }

  async function drop(accessId: string) {
    try {
      await revoke.mutateAsync(accessId)
      notify.success('Acesso revogado')
    } catch (error) {
      notify.error(error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant={variant} size={size}>
            <SteelIcon icon={Link04Icon} strokeWidth={2} />
            {label}
          </Button>
        }
      />
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Acesso ao portal de atendimento</DialogTitle>
          <DialogDescription>
            {contactName ? `${contactName} ` : 'O contato '}recebe um link por
            e-mail que abre o portal sem senha: vale 7 dias, serve uma única vez
            e cria uma sessão de 12 horas.
          </DialogDescription>
        </DialogHeader>

        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='sd-portal-access-email'>Enviar para</Label>
          <Input
            id='sd-portal-access-email'
            type='email'
            value={email}
            placeholder={contactEmail ?? 'e-mail do contato'}
            onChange={(event) => setEmail(event.target.value)}
          />
          <p className='text-muted-foreground text-xs'>
            Em branco, usa o e-mail cadastrado do contato.
          </p>
        </div>

        <div className='flex flex-col gap-2'>
          <p className='font-medium text-sm'>Acessos emitidos</p>
          {accesses.isLoading ? (
            <Skeleton className='h-16 rounded-lg' />
          ) : (accesses.data?.length ?? 0) === 0 ? (
            <p className='text-muted-foreground text-xs'>
              Nenhum acesso enviado a este contato ainda.
            </p>
          ) : (
            <ul className='flex max-h-56 flex-col gap-2 overflow-y-auto'>
              {accesses.data?.map((access) => (
                <li
                  key={access.id}
                  className='flex items-center gap-2 rounded-lg border border-border p-2.5'
                >
                  <div className='min-w-0 flex-1'>
                    <p className='truncate text-xs'>{access.email}</p>
                    <p className='text-muted-foreground text-[11px]'>
                      Enviado {sdFormatDateTime(access.createdAt)} · expira{' '}
                      {sdFormatDateTime(access.expiresAt)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-md px-1.5 py-0.5 font-medium text-[11px]',
                      STATUS_TONE[access.status],
                    )}
                  >
                    {STATUS_LABEL[access.status]}
                  </span>
                  {access.status === 'pending' || access.status === 'active' ? (
                    <Button
                      variant='ghost'
                      size='xs'
                      disabled={revoke.isPending}
                      onClick={() => void drop(access.id)}
                    >
                      Revogar
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => setOpen(false)}>
            Fechar
          </Button>
          <Button
            disabled={issue.isPending || target.length === 0}
            onClick={() => void send()}
          >
            <SteelIcon icon={MailSend01Icon} strokeWidth={2} />
            {issue.isPending ? 'Enviando…' : 'Enviar acesso'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
