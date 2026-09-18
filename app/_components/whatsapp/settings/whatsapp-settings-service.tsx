'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { useIsPrivileged } from '@/app/_components/workspace/workspace-permissions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { notify } from '@/lib/notify'
import {
  useUpdateWhatsAppSettings,
  useWhatsAppSettings,
} from '@/src/hooks/use-whatsapp-settings'

const MAX_HOURS = 720

/** Configurações de atendimento (OWNER/ADMIN): fechamento automático. */
export function WhatsappSettingsService({
  workspaceId,
}: {
  workspaceId: string
}) {
  const isAdmin = useIsPrivileged()
  const settings = useWhatsAppSettings(workspaceId, isAdmin)
  const update = useUpdateWhatsAppSettings(workspaceId)
  const [hours, setHours] = useState('24')

  useEffect(() => {
    if (settings.data) setHours(String(settings.data.autoCloseAfterHours))
  }, [settings.data])

  if (!isAdmin) {
    return (
      <p className='text-muted-foreground text-sm'>
        Somente proprietários e administradores podem alterar as configurações
        de atendimento.
      </p>
    )
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const value = Number(hours)
    if (!Number.isInteger(value) || value < 0 || value > MAX_HOURS) {
      notify.error(`Informe um número inteiro de horas entre 0 e ${MAX_HOURS}`)
      return
    }
    update.mutate(
      { autoCloseAfterHours: value },
      {
        onSuccess: () => notify.success('Configurações de atendimento salvas'),
        onError: (error) => notify.error(error, 'Não foi possível salvar'),
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} className='max-w-lg space-y-4'>
      <div>
        <h3 className='font-medium text-sm'>Fechamento automático</h3>
        <p className='text-muted-foreground text-xs'>
          Conversas sem nenhuma mensagem pelo tempo abaixo são fechadas
          automaticamente e saem da caixa de entrada ativa. Se o contato voltar
          a escrever, a conversa é reaberta.
        </p>
      </div>

      <div className='space-y-1.5'>
        <Label htmlFor='autoCloseAfterHours'>
          Fechar após quantas horas sem mensagens
        </Label>
        <Input
          id='autoCloseAfterHours'
          type='number'
          min={0}
          max={MAX_HOURS}
          step={1}
          value={hours}
          onChange={(event) => setHours(event.target.value)}
          className='w-40'
        />
        <p className='text-muted-foreground text-xs'>
          Use 0 para desligar. Padrão: 24 horas.
        </p>
      </div>

      <Button type='submit' disabled={update.isPending || settings.isLoading}>
        {update.isPending ? 'Salvando...' : 'Salvar'}
      </Button>
    </form>
  )
}
