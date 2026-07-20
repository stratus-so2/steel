import 'server-only'

const META_GRAPH_VERSION = 'v23.0'

export interface MetaTemplateRaw {
  name: string
  language: string
  category: string
  status: string
  components: unknown[]
}

export async function fetchMetaTemplates(input: {
  wabaId: string
  accessToken: string
}): Promise<MetaTemplateRaw[]> {
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${input.wabaId}/message_templates?limit=200`
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${input.accessToken}` },
  })

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      body?.error?.message ?? `Falha ao buscar templates (${response.status})`,
    )
  }

  return (body?.data ?? []) as MetaTemplateRaw[]
}
