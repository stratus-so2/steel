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

export interface CreateMetaTemplateInput {
  wabaId: string
  accessToken: string
  name: string
  language: string
  category: string
  components: unknown[]
}

export async function createMetaTemplate(
  input: CreateMetaTemplateInput,
): Promise<MetaTemplateRaw> {
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${input.wabaId}/message_templates`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: input.name,
      language: input.language,
      category: input.category,
      // Graph API v23.0 passou a exigir isso explicitamente — sem o campo,
      // templates com variáveis {{n}} no corpo são rejeitados com
      // INVALID_FORMAT mesmo com o `example` correto (confirmado contra
      // uma WABA real). Só usamos {{n}} posicional, nunca nomeado.
      parameter_format: 'POSITIONAL',
      components: input.components,
    }),
  })

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      body?.error?.message ?? `Falha ao criar template (${response.status})`,
    )
  }

  return {
    name: input.name,
    language: input.language,
    category: input.category,
    // Meta sempre retorna o template recém-criado como PENDING de revisão.
    status: body?.status ?? 'PENDING',
    components: input.components,
  }
}
