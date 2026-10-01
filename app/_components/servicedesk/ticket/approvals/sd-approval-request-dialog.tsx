'use client'

import { Cancel01Icon } from '@hugeicons-pro/core-stroke-rounded'
import { useEffect, useMemo, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/lib/notify'
import { useSdAgents } from '@/src/hooks/use-sd-config'
import type { RequestSdTicketApprovalInput } from '@/src/hooks/use-sd-ticket-approvals'
import { FieldBlock } from '../../settings/sd-settings-kit'
import { isSdEmail } from './sd-approval-labels'

/**
 * Pedido de aprovação: usuários do workspace e/ou e-mails externos, mensagem
 * e validade do link. Cada aprovador recebe um link; a primeira resposta
 * decide e cancela os demais pedidos pendentes.
 */
export function SdApprovalRequestDialog({
  workspaceId,
  open,
  pending,
  onOpenChange,
  onSubmit,
}: {
  workspaceId: string
  open: boolean
  pending?: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: RequestSdTicketApprovalInput) => void
}) {
  const users = useSdAgents(workspaceId, {
    includeRequesters: true,
    enabled: open,
  })
  const [search, setSearch] = useState('')
  const [userIds, setUserIds] = useState<string[]>([])
  const [emailDraft, setEmailDraft] = useState('')
  const [emails, setEmails] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [days, setDays] = useState('7')

  useEffect(() => {
    if (!open) return
    setSearch('')
    setUserIds([])
    setEmailDraft('')
    setEmails([])
    setMessage('')
    setDays('7')
  }, [open])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (users.data ?? []).filter(
      (u) =>
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    )
  }, [users.data, search])

  function addEmail(raw: string = emailDraft) {
    const value = raw.trim().toLowerCase().replace(/[,;]$/, '')
    if (!value) return
    if (!isSdEmail(value)) {
      notify.error('E-mail inválido')
      return
    }
    if (!emails.includes(value)) setEmails((prev) => [...prev, value])
    setEmailDraft('')
  }

  const expires = Number(days)
  const total = userIds.length + emails.length
  const valid =
    total > 0 &&
    total <= 10 &&
    Number.isInteger(expires) &&
    expires >= 1 &&
    expires <= 60

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Pedir aprovação</DialogTitle>
          <DialogDescription>
            Cada aprovador recebe um link por e-mail. A primeira resposta decide
            e cancela os demais pedidos pendentes.
          </DialogDescription>
        </DialogHeader>
        <form
          className='flex flex-col gap-3'
          onSubmit={(e) => {
            e.preventDefault()
            if (!valid) return
            onSubmit({
              approvers: [
                ...userIds.map((userId) => ({ userId })),
                ...emails.map((email) => ({ email })),
              ],
              message: message.trim() || null,
              expiresInDays: expires,
            })
          }}
        >
          <FieldBlock label='Usuários do workspace'>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Buscar por nome ou e-mail'
              aria-label='Buscar aprovador'
            />
            <ul className='max-h-40 overflow-y-auto rounded-md border border-border'>
              {filtered.length === 0 ? (
                <li className='px-3 py-2 text-muted-foreground text-xs'>
                  Nenhum usuário encontrado.
                </li>
              ) : (
                filtered.map((u) => {
                  const checked = userIds.includes(u.id)
                  return (
                    <li key={u.id}>
                      <div className='flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted'>
                        <Checkbox
                          checked={checked}
                          aria-label={u.name}
                          onCheckedChange={(next) =>
                            setUserIds((prev) =>
                              next
                                ? [...prev, u.id]
                                : prev.filter((id) => id !== u.id),
                            )
                          }
                        />
                        <span className='truncate'>{u.name}</span>
                        <span className='ml-auto truncate text-muted-foreground text-xs'>
                          {u.email}
                        </span>
                      </div>
                    </li>
                  )
                })
              )}
            </ul>
          </FieldBlock>

          <FieldBlock
            label='E-mails externos'
            hint='Enter ou vírgula para adicionar'
          >
            <div className='flex gap-2'>
              <Input
                value={emailDraft}
                onChange={(e) => {
                  const v = e.target.value
                  if (/[,;]$/.test(v)) addEmail(v)
                  else setEmailDraft(v)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addEmail()
                  }
                }}
                placeholder='diretor@cliente.com.br'
                aria-label='E-mail do aprovador'
              />
              <Button
                type='button'
                variant='outline'
                onClick={() => addEmail()}
              >
                Adicionar
              </Button>
            </div>
            {emails.length > 0 ? (
              <ul className='flex flex-wrap gap-1.5'>
                {emails.map((email) => (
                  <li
                    key={email}
                    className='flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs'
                  >
                    {email}
                    <button
                      type='button'
                      aria-label={`Remover ${email}`}
                      onClick={() =>
                        setEmails((prev) => prev.filter((x) => x !== email))
                      }
                    >
                      <SteelIcon icon={Cancel01Icon} size={11} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </FieldBlock>

          <FieldBlock label='Mensagem ao aprovador'>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              aria-label='Mensagem ao aprovador'
              placeholder='O que precisa ser aprovado e por quê'
            />
          </FieldBlock>
          <FieldBlock label='Validade do link (dias)'>
            <Input
              type='number'
              min={1}
              max={60}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              aria-label='Validade em dias'
              className='w-28'
            />
          </FieldBlock>

          <DialogFooter>
            <span className='mr-auto self-center text-muted-foreground text-xs'>
              {total} aprovador{total === 1 ? '' : 'es'}
              {total > 10 ? ' (máximo 10)' : ''}
            </span>
            <Button
              type='button'
              variant='ghost'
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type='submit' disabled={pending || !valid}>
              Enviar pedido
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
