'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { notify } from '@/lib/notify'
import { useWhatsAppConnections } from '@/src/hooks/use-whatsapp-connections'
import {
  useSyncWhatsAppTemplates,
  useWhatsAppTemplates,
} from '@/src/hooks/use-whatsapp-templates'

export function WhatsappSettingsTemplates({
  workspaceId,
}: {
  workspaceId: string
}) {
  const connections = useWhatsAppConnections(workspaceId)
  const metaConnections = (connections.data ?? []).filter(
    (connection) => connection.provider === 'META',
  )
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>()

  const templates = useWhatsAppTemplates(workspaceId)
  const syncTemplates = useSyncWhatsAppTemplates(workspaceId)

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between gap-3'>
        <div>
          <h3 className='font-medium text-sm'>Templates da Meta</h3>
          <p className='text-muted-foreground text-xs'>
            Sincronize os templates aprovados na sua conta Meta
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <Select
            value={selectedConnectionId}
            onValueChange={(value) =>
              setSelectedConnectionId(value ?? undefined)
            }
          >
            <SelectTrigger className='w-52'>
              <SelectValue placeholder='Conexão Meta' />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                {metaConnections.map((connection) => (
                  <SelectItem key={connection.id} value={connection.id}>
                    {connection.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button
            size='sm'
            disabled={!selectedConnectionId || syncTemplates.isPending}
            onClick={() => {
              if (!selectedConnectionId) return
              syncTemplates.mutate(selectedConnectionId, {
                onSuccess: () => notify.success('Templates sincronizados'),
                onError: (error) => notify.error(error, 'Falha ao sincronizar'),
              })
            }}
          >
            {syncTemplates.isPending ? 'Sincronizando...' : 'Sincronizar agora'}
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Idioma</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(templates.data ?? []).map((template) => (
            <TableRow key={template.id}>
              <TableCell>{template.name}</TableCell>
              <TableCell>{template.language}</TableCell>
              <TableCell>{template.category}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    template.status === 'APPROVED' ? 'default' : 'secondary'
                  }
                >
                  {template.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
          {templates.data?.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className='text-muted-foreground text-sm'>
                Nenhum template sincronizado ainda.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
