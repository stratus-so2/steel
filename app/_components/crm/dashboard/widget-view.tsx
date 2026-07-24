'use client'

import { ChartWidget } from '@/app/_components/crm/dashboard/widgets/chart-widget'
import { IframeWidget } from '@/app/_components/crm/dashboard/widgets/iframe-widget'
import { RichTextWidget } from '@/app/_components/crm/dashboard/widgets/rich-text-widget'
import { ViewWidget } from '@/app/_components/crm/dashboard/widgets/view-widget'
import type {
  ChartConfig,
  IframeConfig,
  RichTextConfig,
  ViewConfig,
} from '@/src/schemas/crm-dashboard.schema'
import type { CrmDashboardWidgetDTO } from '@/types/crm-dashboard'

/** Renderiza o conteúdo de um widget conforme o tipo (config é Json no DTO). */
export function WidgetView({
  widget,
  workspaceId,
}: {
  widget: CrmDashboardWidgetDTO
  workspaceId: string
}) {
  switch (widget.type) {
    case 'CHART':
      return (
        <ChartWidget
          workspaceId={workspaceId}
          config={widget.config as ChartConfig}
        />
      )
    case 'VIEW':
      return (
        <ViewWidget
          workspaceId={workspaceId}
          config={widget.config as ViewConfig}
        />
      )
    case 'IFRAME':
      return <IframeWidget config={widget.config as IframeConfig} />
    case 'RICH_TEXT':
      return <RichTextWidget config={widget.config as RichTextConfig} />
    default:
      return null
  }
}
