import 'server-only'
import { render } from '@react-email/render'
import {
  MARKETING_TEMPLATES,
  type MarketingTemplateId,
  resolveMarketingTemplateProps,
} from '@/src/lib/crm-marketing-templates'

/** Renderiza um layout fixo de marketing (texto/imagem preenchidos pelo
 * usuário) para HTML estático — mesmo caminho usado no preview e no envio. */
export async function renderMarketingTemplate(
  templateId: MarketingTemplateId,
  props: Record<string, string> | undefined,
): Promise<string> {
  const merged = resolveMarketingTemplateProps(templateId, props)
  const element = MARKETING_TEMPLATES[templateId].render(merged)
  return render(element)
}
