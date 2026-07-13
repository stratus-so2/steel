'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { notify } from '@/lib/notify'
import {
  useDeleteWorkspaceConnection,
  useSaveWorkspaceConnection,
  useTestWorkspaceConnection,
  useWorkspaceConnections,
} from '@/src/hooks/use-workspace-connections'
import type {
  ModuleKind,
  WorkspaceConnectionDTO,
} from '@/types/workspace-connection'

const MODULES: { key: ModuleKind; label: string; description: string }[] = [
  {
    key: 'SERVICE_DESK',
    label: 'ServiceDesk',
    description: 'Banco de dados usado pelo sistema de atendimento.',
  },
  {
    key: 'CRM',
    label: 'CRM',
    description: 'Banco de dados usado pelo sistema de CRM.',
  },
  {
    key: 'COMMUNICATION',
    label: 'Comunicação',
    description:
      'Banco de dados usado pelo sistema de comunicação (WhatsApp Business).',
  },
]

interface FormState {
  host: string
  port: string
  username: string
  password: string
  database: string
  sslEnabled: boolean
}

const EMPTY_FORM: FormState = {
  host: '',
  port: '5432',
  username: '',
  password: '',
  database: '',
  sslEnabled: true,
}

export function ConnectionsManager({ workspaceId }: { workspaceId: string }) {
  const { data: connections, isLoading } = useWorkspaceConnections(workspaceId)

  if (isLoading) {
    return (
      <p className='text-sm text-muted-foreground'>Carregando conexões...</p>
    )
  }

  return (
    <div className='grid gap-6 md:grid-cols-2 xl:grid-cols-3'>
      {MODULES.map((module) => (
        <ModuleConnectionCard
          key={module.key}
          workspaceId={workspaceId}
          module={module.key}
          label={module.label}
          description={module.description}
          existing={connections?.find((c) => c.module === module.key)}
        />
      ))}
    </div>
  )
}

function ModuleConnectionCard({
  workspaceId,
  module,
  label,
  description,
  existing,
}: {
  workspaceId: string
  module: ModuleKind
  label: string
  description: string
  existing?: WorkspaceConnectionDTO
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const saveConnection = useSaveWorkspaceConnection(workspaceId)
  const deleteConnection = useDeleteWorkspaceConnection(workspaceId)
  const testConnection = useTestWorkspaceConnection(workspaceId)

  useEffect(() => {
    setForm(
      existing
        ? {
            host: existing.host,
            port: String(existing.port),
            username: existing.username,
            password: '',
            database: existing.database,
            sslEnabled: existing.sslEnabled,
          }
        : EMPTY_FORM,
    )
  }, [existing])

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function parsedPayload() {
    return {
      host: form.host,
      port: Number(form.port),
      username: form.username,
      password: form.password,
      database: form.database,
      sslEnabled: form.sslEnabled,
    }
  }

  function handleSave(event: FormEvent) {
    event.preventDefault()

    saveConnection.mutate(
      { module, ...parsedPayload() },
      {
        onSuccess: () => notify.success(`Conexão de ${label} salva`),
        onError: (error) =>
          notify.error(error, 'Não foi possível salvar a conexão'),
      },
    )
  }

  function handleTest() {
    testConnection.mutate(
      { module, ...parsedPayload() },
      {
        onSuccess: () => notify.success('Conexão bem-sucedida'),
        onError: (error) => notify.error(error, 'Não foi possível conectar'),
      },
    )
  }

  function handleDelete() {
    deleteConnection.mutate(module, {
      onSuccess: () => notify.success(`Conexão de ${label} removida`),
      onError: (error) =>
        notify.error(error, 'Não foi possível remover a conexão'),
    })
  }

  const isBusy =
    saveConnection.isPending ||
    testConnection.isPending ||
    deleteConnection.isPending

  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSave}>
        <CardContent className='space-y-3'>
          <div className='space-y-1.5'>
            <Label htmlFor={`${module}-host`}>Host</Label>
            <Input
              id={`${module}-host`}
              required
              placeholder='db.cliente.com'
              value={form.host}
              onChange={(event) => updateField('host', event.target.value)}
              disabled={isBusy}
            />
          </div>
          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1.5'>
              <Label htmlFor={`${module}-port`}>Porta</Label>
              <Input
                id={`${module}-port`}
                type='number'
                required
                value={form.port}
                onChange={(event) => updateField('port', event.target.value)}
                disabled={isBusy}
              />
            </div>
            <div className='space-y-1.5'>
              <Label htmlFor={`${module}-database`}>Banco</Label>
              <Input
                id={`${module}-database`}
                required
                value={form.database}
                onChange={(event) =>
                  updateField('database', event.target.value)
                }
                disabled={isBusy}
              />
            </div>
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor={`${module}-username`}>Usuário</Label>
            <Input
              id={`${module}-username`}
              required
              value={form.username}
              onChange={(event) => updateField('username', event.target.value)}
              disabled={isBusy}
            />
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor={`${module}-password`}>Senha</Label>
            <Input
              id={`${module}-password`}
              type='password'
              required={!existing}
              placeholder={existing ? '••••••••' : ''}
              value={form.password}
              onChange={(event) => updateField('password', event.target.value)}
              disabled={isBusy}
            />
          </div>
          <div className='flex items-center justify-between pt-1'>
            <Label htmlFor={`${module}-ssl`}>SSL</Label>
            <Switch
              id={`${module}-ssl`}
              checked={form.sslEnabled}
              onCheckedChange={(checked) =>
                updateField('sslEnabled', checked === true)
              }
              disabled={isBusy}
            />
          </div>
        </CardContent>
        <CardFooter className='flex-wrap gap-2'>
          <Button type='submit' disabled={isBusy}>
            {saveConnection.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
          <Button
            type='button'
            variant='secondary'
            disabled={isBusy || !form.password}
            onClick={handleTest}
          >
            {testConnection.isPending ? 'Testando...' : 'Testar conexão'}
          </Button>
          {existing ? (
            <Button
              type='button'
              variant='ghost'
              disabled={isBusy}
              onClick={handleDelete}
            >
              Remover
            </Button>
          ) : null}
        </CardFooter>
      </form>
    </Card>
  )
}
