'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/lib/notify'
import {
  useSaveWhatsAppAiConfig,
  useWhatsAppAiConfig,
} from '@/src/hooks/use-whatsapp-ai-config'

const DEFAULT_PROMPT =
  'Você é um assistente de atendimento via WhatsApp. Seja educado, objetivo e ajude o cliente da melhor forma possível.'

export function WhatsappSettingsAi({ workspaceId }: { workspaceId: string }) {
  const aiConfig = useWhatsAppAiConfig(workspaceId)
  const saveAiConfig = useSaveWhatsAppAiConfig(workspaceId)

  const [openaiApiKey, setOpenaiApiKey] = useState('')
  const [model, setModel] = useState('gpt-4o-mini')
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_PROMPT)
  const [active, setActive] = useState(false)
  const [readMedia, setReadMedia] = useState(false)

  useEffect(() => {
    if (aiConfig.data) {
      setModel(aiConfig.data.model)
      setSystemPrompt(aiConfig.data.systemPrompt)
      setActive(aiConfig.data.active)
      setReadMedia(aiConfig.data.readMedia)
    }
  }, [aiConfig.data])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    saveAiConfig.mutate(
      {
        openaiApiKey: openaiApiKey || undefined,
        model,
        systemPrompt,
        active,
        readMedia,
      },
      {
        onSuccess: () => {
          notify.success('Configuração de IA salva')
          setOpenaiApiKey('')
        },
        onError: (error) => notify.error(error, 'Não foi possível salvar'),
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} className='max-w-lg space-y-4'>
      <div>
        <h3 className='font-medium text-sm'>Configurar IA</h3>
        <p className='text-muted-foreground text-xs'>
          Quando ativa, a IA responde automaticamente conversas novas até que um
          atendente assuma a conversa manualmente.
        </p>
      </div>

      <div className='flex items-center justify-between rounded-md border p-3'>
        <div>
          <p className='font-medium text-sm'>IA ativa</p>
          <p className='text-muted-foreground text-xs'>
            {aiConfig.data?.hasApiKey
              ? 'Chave da OpenAI configurada'
              : 'Nenhuma chave configurada ainda'}
          </p>
        </div>
        <Switch checked={active} onCheckedChange={setActive} />
      </div>

      <div className='flex items-center justify-between rounded-md border p-3'>
        <div>
          <p className='font-medium text-sm'>Ler imagens e áudios</p>
          <p className='text-muted-foreground text-xs'>
            A IA passa a enxergar fotos (Vision) e transcrever áudios (Whisper)
            recebidos do cliente antes de responder. Aumenta o custo e o tempo
            de resposta por mensagem de mídia.
          </p>
        </div>
        <Switch checked={readMedia} onCheckedChange={setReadMedia} />
      </div>

      <div className='space-y-1.5'>
        <Label htmlFor='openaiApiKey'>Chave da API OpenAI</Label>
        <Input
          id='openaiApiKey'
          type='password'
          placeholder={aiConfig.data?.hasApiKey ? '••••••••••••' : 'sk-...'}
          value={openaiApiKey}
          onChange={(event) => setOpenaiApiKey(event.target.value)}
        />
      </div>

      <div className='space-y-1.5'>
        <Label htmlFor='model'>Modelo</Label>
        <Input
          id='model'
          value={model}
          onChange={(event) => setModel(event.target.value)}
        />
      </div>

      <div className='space-y-1.5'>
        <Label htmlFor='systemPrompt'>Instruções da IA</Label>
        <Textarea
          id='systemPrompt'
          rows={6}
          value={systemPrompt}
          onChange={(event) => setSystemPrompt(event.target.value)}
        />
      </div>

      <Button type='submit' disabled={saveAiConfig.isPending}>
        {saveAiConfig.isPending ? 'Salvando...' : 'Salvar configuração'}
      </Button>
    </form>
  )
}
