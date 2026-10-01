'use client'

import {
  CheckmarkCircle02Icon,
  CustomerService01Icon,
  Mail01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRequestSdPortalLink } from '@/src/hooks/use-sd-external-portal'

/**
 * `/suporte`: o contato informa o e-mail e recebe o link de acesso. A
 * resposta é **sempre a mesma**, exista ou não o e-mail — a tela não serve
 * para descobrir quem é cliente.
 */
export function SdExtRequestLink() {
  const request = useRequestSdPortalLink()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const value = email.trim()
    if (!value) return
    setError(null)
    try {
      const result = await request.mutateAsync(value)
      setSent(result.message)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não conseguimos enviar o link agora',
      )
    }
  }

  return (
    <div className='flex min-h-screen items-center justify-center bg-muted/30 p-6'>
      <div className='w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8'>
        <div className='flex size-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-700 dark:text-blue-300'>
          <SteelIcon
            icon={CustomerService01Icon}
            strokeWidth={1.8}
            className='size-5'
          />
        </div>
        <h1 className='mt-4 font-semibold text-xl'>Portal de atendimento</h1>
        <p className='mt-1 text-muted-foreground text-sm'>
          Acompanhe e abra chamados com a equipe que atende sua empresa. Sem
          senha: a gente manda um link de acesso para o seu e-mail.
        </p>

        {sent ? (
          <div
            role='status'
            className='mt-6 flex flex-col gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm'
          >
            <p className='flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-300'>
              <SteelIcon icon={CheckmarkCircle02Icon} strokeWidth={2} />
              Verifique seu e-mail
            </p>
            <p className='text-muted-foreground text-xs'>{sent}</p>
            <Button
              variant='outline'
              size='sm'
              className='mt-1 self-start'
              onClick={() => setSent(null)}
            >
              Usar outro e-mail
            </Button>
          </div>
        ) : (
          <form className='mt-6 flex flex-col gap-3' onSubmit={submit}>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='sd-portal-email'>Seu e-mail</Label>
              <Input
                id='sd-portal-email'
                type='email'
                required
                autoComplete='email'
                inputMode='email'
                placeholder='voce@suaempresa.com.br'
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <p className='text-muted-foreground text-xs'>
                Use o e-mail que você passou para a equipe de atendimento.
              </p>
            </div>
            {error ? (
              <p
                role='alert'
                className='rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-red-700 text-xs dark:text-red-300'
              >
                {error}
              </p>
            ) : null}
            <Button
              type='submit'
              size='lg'
              disabled={request.isPending || email.trim().length === 0}
            >
              <SteelIcon icon={Mail01Icon} strokeWidth={2} />
              {request.isPending ? 'Enviando…' : 'Receber link de acesso'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
