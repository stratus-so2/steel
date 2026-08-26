'use client'

import { Muted } from '@/components/typography/text/muted'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useCrmResourceList } from '@/src/hooks/use-crm-resource-list'
import type { CrmActivityDTO } from '@/types/crm-activity'

const dateFmt = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

const ACTION_LABEL: Record<string, string> = {
  CREATED: 'Criado',
  UPDATED: 'Atualizado',
  DELETED: 'Excluído',
}

export function CrmAuditLogSection({ workspaceId }: { workspaceId: string }) {
  const { items, isLoading } = useCrmResourceList<CrmActivityDTO>(
    workspaceId,
    'activities',
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log de auditoria</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Muted>Carregando...</Muted>
        ) : items.length === 0 ? (
          <Muted>Nenhuma atividade registrada ainda.</Muted>
        ) : (
          <div className='max-h-[32rem] overflow-auto rounded-lg border border-border'>
            <Table>
              <TableHeader className='sticky top-0 z-10 bg-card/85 backdrop-blur-md'>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Resumo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items
                  .slice()
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .slice(0, 100)
                  .map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className='whitespace-nowrap text-muted-foreground text-xs'>
                        {dateFmt.format(new Date(item.createdAt))}
                      </TableCell>
                      <TableCell className='capitalize'>
                        {item.entity}
                      </TableCell>
                      <TableCell>
                        <Badge variant='secondary'>
                          {ACTION_LABEL[item.action] ?? item.action}
                        </Badge>
                      </TableCell>
                      <TableCell className='text-muted-foreground text-sm'>
                        {item.summary ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
