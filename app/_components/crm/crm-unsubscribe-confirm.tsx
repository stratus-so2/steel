'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { CrmEmailUnsubscribeResultDTO } from '@/types/crm-email-marketing'

type State =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'done'; result: CrmEmailUnsubscribeResultDTO }
  | { kind: 'error'; message: string }

/** Botão de confirmação da página pública `/unsubscribe/<token>`. */
export function CrmUnsubscribeConfirm({
  token,
  email,
}: {
  token: string
  email: string
}) {
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function confirm() {
    setState({ kind: 'pending' })
    try {
      const response = await fetch(
        `/api/crm/unsubscribe/${encodeURIComponent(token)}`,
        { method: 'POST' },
      )
      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.success) {
        setState({
          kind: 'error',
          message:
            body?.error?.message ??
            'Não foi possível concluir o descadastro. Tente novamente.',
        })
        return
      }
      setState({ kind: 'done', result: body.data })
    } catch {
      setState({
        kind: 'error',
        message: 'Falha de conexão. Tente novamente.',
      })
    }
  }

  if (state.kind === 'done') {
    return (
      <div className='space-y-2'>
        <h1 className='font-semibold text-lg'>Descadastro confirmado</h1>
        <p className='text-muted-foreground text-sm'>
          {state.result.alreadyOptedOut
            ? `O endereço ${state.result.email} já estava descadastrado.`
            : `O endereço ${state.result.email} não receberá mais nossas campanhas de e-mail.`}{' '}
          Mensagens essenciais da sua conta (como redefinição de senha) não são
          afetadas.
        </p>
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      <div className='space-y-2'>
        <h1 className='font-semibold text-lg'>Descadastrar e-mails</h1>
        <p className='text-muted-foreground text-sm'>
          Deseja parar de receber campanhas de e-mail neste endereço?
        </p>
        <p className='font-medium text-sm'>{email}</p>
      </div>
      {state.kind === 'error' ? (
        <p className='text-destructive text-sm'>{state.message}</p>
      ) : null}
      <Button
        className='w-full'
        onClick={confirm}
        disabled={state.kind === 'pending'}
      >
        {state.kind === 'pending' ? 'Descadastrando…' : 'Confirmar descadastro'}
      </Button>
    </div>
  )
}
