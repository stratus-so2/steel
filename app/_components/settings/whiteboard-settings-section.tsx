'use client'

import { useRouter } from 'next/navigation'
import { Muted } from '@/components/typography/text/muted'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { notify } from '@/lib/notify'
import {
  useUpdateWhiteboardSettings,
  useWhiteboardSettings,
} from '@/src/hooks/use-whiteboard'
import { useIsWorkspaceAdmin } from '../workspace/workspace-permissions'

/** Ajustes › Quadro-branco: the workspace switch (OWNER/ADMIN). */
export function WhiteboardSettingsSection({
  workspaceId,
}: {
  workspaceId: string
}) {
  const canEdit = useIsWorkspaceAdmin() === true
  const router = useRouter()
  const { data, isPending } = useWhiteboardSettings(workspaceId)
  const update = useUpdateWhiteboardSettings(workspaceId)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quadro-branco do workspace</CardTitle>
        <CardDescription>
          Quadros Excalidraw para desenhar fluxos, mapas e rascunhos, com
          salvamento automático e histórico de versões. Vem ligado; ao desligar,
          o item Quadro-branco some do menu lateral e os quadros ficam guardados
          até ser ligado de novo.
        </CardDescription>
      </CardHeader>
      <CardContent className='flex items-center justify-between gap-4'>
        <Label
          htmlFor='whiteboard-enabled'
          className='flex flex-col items-start'
        >
          <span>Ativar Quadro-branco</span>
          {!canEdit && (
            <Muted className='text-xs font-normal'>
              Só proprietários e administradores podem alterar.
            </Muted>
          )}
        </Label>
        {isPending ? (
          <Skeleton className='h-5 w-9 rounded-full' />
        ) : (
          <Switch
            id='whiteboard-enabled'
            checked={data?.enabled ?? true}
            disabled={!canEdit || update.isPending}
            onCheckedChange={(enabled) =>
              update.mutate(
                { enabled },
                {
                  onSuccess: () => {
                    notify.success(
                      enabled
                        ? 'Quadro-branco ativado'
                        : 'Quadro-branco desativado',
                    )
                    // The rail entry is rendered by the workspace layout.
                    router.refresh()
                  },
                  onError: notify.error,
                },
              )
            }
          />
        )}
      </CardContent>
    </Card>
  )
}
