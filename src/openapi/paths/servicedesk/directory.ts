import { z } from 'zod'
import {
  CreateSdConfigItemSchema,
  CreateSdConfigItemTypeSchema,
  ListSdConfigItemsSchema,
  SdConfigItemOptionsSchema,
  UpdateSdConfigItemSchema,
  UpdateSdConfigItemTypeSchema,
} from '@/src/schemas/sd-config-item.schema'
import {
  CreateSdContactSchema,
  ListSdContactsSchema,
  SdContactOptionsSchema,
  UpdateSdContactSchema,
} from '@/src/schemas/sd-contact.schema'
import {
  CreateSdCustomerSchema,
  ImportSdCustomersSchema,
  ListSdCustomersSchema,
  SdCustomerOptionsSchema,
  UpdateSdCustomerSchema,
} from '@/src/schemas/sd-customer.schema'
import {
  SdImportRowsSchema,
  SdOptionsQuerySchema,
} from '@/src/schemas/sd-directory.schema'
import type { ErrorEntry, RouteConfig } from '../../registry'
import {
  SdCepAddressDTO,
  SdConfigItemDetailDTO,
  SdConfigItemDTO,
  SdConfigItemTypeDTO,
  SdContactDetailDTO,
  SdContactDTO,
  SdCustomerDetailDTO,
  SdCustomerDTO,
  SdImportResultDTO,
  SdOptionDTO,
  sdPage,
} from '../../schemas/servicedesk/directory'

/**
 * ServiceDesk · cadastros — `app/api/workspaces/[id]/servicedesk/{customers,
 * contacts,config-items,config-item-types,cep}/**`.
 */

const PEOPLE = 'ServiceDesk · Clientes e contatos' as const
const CMDB = 'ServiceDesk · CMDB' as const

const SD_ERRORS: ErrorEntry[] = [
  {
    code: 'FORBIDDEN',
    when: 'Não é membro do workspace ou o perfil não concede a permissão',
  },
  'WORKSPACE_SUSPENDED',
  { code: 'MODULE_DISABLED', when: 'Módulo ServiceDesk desabilitado' },
]

/** Cadastros: só agentes (membro de departamento) ou admins. */
const AGENT_ERRORS: ErrorEntry[] = [
  ...SD_ERRORS,
  { code: 'SD_NOT_AGENT', when: 'Solicitante (sem departamento)' },
]

const ADMIN_ERRORS: ErrorEntry[] = [
  {
    code: 'FORBIDDEN',
    when: 'Não é membro ou não é admin do ServiceDesk',
  },
  'WORKSPACE_SUSPENDED',
  { code: 'MODULE_DISABLED', when: 'Módulo ServiceDesk desabilitado' },
]

function access(resource: string, action: string): string {
  return `Acesso: sessão + **agente** do ServiceDesk (membro de um departamento, ou admin) com a permissão \`${resource}\` × \`${action}\` (OWNER/ADMIN sempre passam).`
}

const ADMIN_ACCESS =
  'Acesso: sessão + **admin** do ServiceDesk (OWNER/ADMIN ou perfil com `sd-settings:EDIT`).'

const CLEARABLE =
  'Atualização parcial; `null` (ou `""` nos textos) limpa o valor ou desvincula.'

const CUSTOM_FIELDS_NOTE =
  '`customFields` aceita um objeto `{ chave: primitivo | primitivo[] }`.'

const CUSTOMER_ID = { customerId: 'ID do cliente/empresa.' }
const CONTACT_ID = { contactId: 'ID do contato.' }
const ITEM_ID = { itemId: 'ID do item de configuração.' }
const TYPE_ID = { typeId: 'ID do tipo de item.' }

const DOC_ERRORS: ErrorEntry[] = [
  { code: 'SD_DOCUMENT_INVALID', when: 'CPF/CNPJ inválido ou incompatível' },
  {
    code: 'SD_CUSTOMER_DOCUMENT_CONFLICT',
    when: 'Outro cadastro ativo já usa o documento',
  },
]

const CI_REF_ERRORS: ErrorEntry[] = [
  { code: 'SD_CONFIG_ITEM_TYPE_NOT_FOUND', when: 'Tipo inexistente' },
  { code: 'SD_CONFIG_ITEM_NOT_FOUND', when: 'Item pai inexistente' },
  { code: 'SD_CUSTOMER_NOT_FOUND', when: 'Cliente inexistente' },
  { code: 'SD_DEPARTMENT_NOT_FOUND', when: 'Departamento inexistente' },
  {
    code: 'VALIDATION_ERROR',
    when: 'Atributos inválidos para o tipo, ou responsável não é membro',
  },
]

export const sdDirectoryRoutes: RouteConfig[] = [
  /* ---------------------------------- CEP ---------------------------------- */
  {
    method: 'get',
    path: '/workspaces/{id}/servicedesk/cep/{cep}',
    tags: [PEOPLE],
    summary: 'Consultar CEP (ViaCEP)',
    description:
      'Resolve o endereço pelo ViaCEP (timeout de 4s), com cache de 30 dias no Redis. Acesso: qualquer membro do ServiceDesk.',
    params: { cep: 'CEP com 8 dígitos (com ou sem hífen).' },
    responses: { 200: { description: 'Endereço.', schema: SdCepAddressDTO } },
    errors: [
      ...SD_ERRORS,
      { code: 'VALIDATION_ERROR', when: 'CEP sem 8 dígitos' },
      'SD_CEP_NOT_FOUND',
      { code: 'SD_CEP_LOOKUP_FAILED', when: 'ViaCEP indisponível' },
    ],
  },

  /* ------------------------------- clientes -------------------------------- */
  {
    method: 'get',
    path: '/workspaces/{id}/servicedesk/customers',
    tags: [PEOPLE],
    summary: 'Listar clientes/empresas',
    description: `Paginado. \`q\` busca em nome, fantasia, documento (com ou sem máscara), e-mail e cidade. ${access('sd-customers', 'VIEW')}`,
    query: ListSdCustomersSchema,
    responses: {
      200: { description: 'Página.', schema: sdPage(SdCustomerDTO) },
    },
    errors: AGENT_ERRORS,
  },
  {
    method: 'post',
    path: '/workspaces/{id}/servicedesk/customers',
    tags: [PEOPLE],
    summary: 'Criar cliente/empresa',
    description: `\`kind\` = CLIENT (Clientes) ou COMPANY (Empresas). CPF/CNPJ (inclusive o alfanumérico de 2026) validado e único; \`personType\` inferido do documento; telefones normalizados. ${CUSTOM_FIELDS_NOTE} ${access('sd-customers', 'CREATE')}`,
    consent: true,
    body: CreateSdCustomerSchema,
    responses: { 201: { description: 'Criado.', schema: SdCustomerDTO } },
    errors: [...AGENT_ERRORS, ...DOC_ERRORS],
  },
  {
    method: 'post',
    path: '/workspaces/{id}/servicedesk/customers/import',
    tags: [PEOPLE],
    summary: 'Importar clientes/empresas (planilha)',
    description: `Linhas já convertidas do CSV em \`{ coluna: valor }\` com cabeçalhos normalizados (minúsculas, sem acento, \`_\`). Colunas aceitas: nome/razao_social, fantasia, documento/cpf/cnpj, email, telefone, whatsapp/celular, cep, logradouro, numero, complemento, bairro, cidade, uf, ibge, observacoes. Cada linha é validada e criada separadamente; as recusadas voltam com o número da linha (cabeçalho = 1). ${access('sd-customers', 'CREATE')}`,
    consent: true,
    body: ImportSdCustomersSchema,
    responses: {
      200: { description: 'Resultado.', schema: SdImportResultDTO },
    },
    errors: AGENT_ERRORS,
  },
  {
    method: 'get',
    path: '/workspaces/{id}/servicedesk/customers/options',
    tags: [PEOPLE],
    summary: 'Seletor de clientes/empresas',
    description: `Busca leve para comboboxes (ativos). ${access('sd-customers', 'VIEW')}`,
    query: SdCustomerOptionsSchema,
    responses: {
      200: { description: 'Opções.', schema: z.array(SdOptionDTO) },
    },
    errors: AGENT_ERRORS,
  },
  {
    method: 'get',
    path: '/workspaces/{id}/servicedesk/customers/{customerId}',
    tags: [PEOPLE],
    summary: 'Detalhar cliente/empresa',
    description: `Inclui contatos e os 10 chamados mais recentes (como cliente ou empresa). ${access('sd-customers', 'VIEW')}`,
    params: CUSTOMER_ID,
    responses: {
      200: { description: 'Cadastro.', schema: SdCustomerDetailDTO },
    },
    errors: [...AGENT_ERRORS, 'SD_CUSTOMER_NOT_FOUND'],
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/servicedesk/customers/{customerId}',
    tags: [PEOPLE],
    summary: 'Atualizar cliente/empresa',
    description: `${CLEARABLE} ${access('sd-customers', 'EDIT')}`,
    params: CUSTOMER_ID,
    consent: true,
    body: UpdateSdCustomerSchema,
    responses: { 200: { description: 'Atualizado.', schema: SdCustomerDTO } },
    errors: [...AGENT_ERRORS, 'SD_CUSTOMER_NOT_FOUND', ...DOC_ERRORS],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/servicedesk/customers/{customerId}',
    tags: [PEOPLE],
    summary: 'Excluir cliente/empresa',
    description: `Exclusão lógica. ${access('sd-customers', 'DELETE')}`,
    params: CUSTOMER_ID,
    consent: true,
    responses: { 200: { description: 'Excluído.', schema: null } },
    errors: [...AGENT_ERRORS, 'SD_CUSTOMER_NOT_FOUND'],
  },

  /* ------------------------------- contatos -------------------------------- */
  {
    method: 'get',
    path: '/workspaces/{id}/servicedesk/contacts',
    tags: [PEOPLE],
    summary: 'Listar contatos',
    description: `Paginado. \`q\` busca em nome, cargo, e-mail e telefones; \`customerId\` filtra por cliente/empresa. ${access('sd-contacts', 'VIEW')}`,
    query: ListSdContactsSchema,
    responses: {
      200: { description: 'Página.', schema: sdPage(SdContactDTO) },
    },
    errors: AGENT_ERRORS,
  },
  {
    method: 'post',
    path: '/workspaces/{id}/servicedesk/contacts',
    tags: [PEOPLE],
    summary: 'Criar contato',
    description: `Vincula a um ou mais clientes/empresas (um principal; sem marcação, o primeiro). \`userId\` precisa ser membro do workspace. ${CUSTOM_FIELDS_NOTE} ${access('sd-contacts', 'CREATE')}`,
    consent: true,
    body: CreateSdContactSchema,
    responses: { 201: { description: 'Criado.', schema: SdContactDTO } },
    errors: [
      ...AGENT_ERRORS,
      { code: 'SD_CUSTOMER_NOT_FOUND', when: 'Cliente vinculado inexistente' },
      {
        code: 'VALIDATION_ERROR',
        when: 'Usuário vinculado não é membro do workspace',
      },
    ],
  },
  {
    method: 'post',
    path: '/workspaces/{id}/servicedesk/contacts/import',
    tags: [PEOPLE],
    summary: 'Importar contatos (planilha)',
    description: `Como a importação de clientes. Colunas: nome, cargo, email, telefone, whatsapp/celular, observacoes e documento_cliente (CPF/CNPJ do cliente/empresa a vincular como principal). ${access('sd-contacts', 'CREATE')}`,
    consent: true,
    body: SdImportRowsSchema,
    responses: {
      200: { description: 'Resultado.', schema: SdImportResultDTO },
    },
    errors: AGENT_ERRORS,
  },
  {
    method: 'get',
    path: '/workspaces/{id}/servicedesk/contacts/options',
    tags: [PEOPLE],
    summary: 'Seletor de contatos',
    description: `Busca leve (ativos), opcionalmente só de um cliente. ${access('sd-contacts', 'VIEW')}`,
    query: SdContactOptionsSchema,
    responses: {
      200: { description: 'Opções.', schema: z.array(SdOptionDTO) },
    },
    errors: AGENT_ERRORS,
  },
  {
    method: 'get',
    path: '/workspaces/{id}/servicedesk/contacts/user-options',
    tags: [PEOPLE],
    summary: 'Seletor de usuários do workspace',
    description: `Membros do workspace (usuário vinculado ao contato, responsável do CI). ${access('sd-contacts', 'VIEW')}`,
    query: SdOptionsQuerySchema,
    responses: {
      200: { description: 'Opções.', schema: z.array(SdOptionDTO) },
    },
    errors: AGENT_ERRORS,
  },
  {
    method: 'get',
    path: '/workspaces/{id}/servicedesk/contacts/lookup',
    tags: [PEOPLE],
    summary: 'Encontrar contato por WhatsApp ou e-mail',
    description: `Casa o WhatsApp com e sem o nono dígito (celulares BR) ou o e-mail (sem diferenciar maiúsculas); \`null\` quando nada casa. ${access('sd-contacts', 'VIEW')}`,
    query: z.object({
      whatsapp: z.string().optional(),
      email: z.string().optional(),
    }),
    responses: {
      200: {
        description: 'Contato ou `null`.',
        schema: SdContactDTO.nullable(),
      },
    },
    errors: AGENT_ERRORS,
  },
  {
    method: 'get',
    path: '/workspaces/{id}/servicedesk/contacts/{contactId}',
    tags: [PEOPLE],
    summary: 'Detalhar contato',
    description: `Inclui os 10 chamados mais recentes. ${access('sd-contacts', 'VIEW')}`,
    params: CONTACT_ID,
    responses: { 200: { description: 'Contato.', schema: SdContactDetailDTO } },
    errors: [...AGENT_ERRORS, 'SD_CONTACT_NOT_FOUND'],
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/servicedesk/contacts/{contactId}',
    tags: [PEOPLE],
    summary: 'Atualizar contato',
    description: `${CLEARABLE} \`customers\`, quando enviado, substitui todos os vínculos. ${access('sd-contacts', 'EDIT')}`,
    params: CONTACT_ID,
    consent: true,
    body: UpdateSdContactSchema,
    responses: { 200: { description: 'Atualizado.', schema: SdContactDTO } },
    errors: [
      ...AGENT_ERRORS,
      'SD_CONTACT_NOT_FOUND',
      { code: 'SD_CUSTOMER_NOT_FOUND', when: 'Cliente vinculado inexistente' },
    ],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/servicedesk/contacts/{contactId}',
    tags: [PEOPLE],
    summary: 'Excluir contato',
    description: `Exclusão lógica. ${access('sd-contacts', 'DELETE')}`,
    params: CONTACT_ID,
    consent: true,
    responses: { 200: { description: 'Excluído.', schema: null } },
    errors: [...AGENT_ERRORS, 'SD_CONTACT_NOT_FOUND'],
  },

  /* ----------------------------- tipos de CI ------------------------------- */
  {
    method: 'get',
    path: '/workspaces/{id}/servicedesk/config-item-types',
    tags: [CMDB],
    summary: 'Listar tipos de item',
    description: `Ordenados por posição, com a contagem de itens. ${access('sd-config-items', 'VIEW')}`,
    responses: {
      200: { description: 'Tipos.', schema: z.array(SdConfigItemTypeDTO) },
    },
    errors: AGENT_ERRORS,
  },
  {
    method: 'post',
    path: '/workspaces/{id}/servicedesk/config-item-types',
    tags: [CMDB],
    summary: 'Criar tipo de item',
    description: `\`attributeSchema\`: \`[{key,label,type: text|number|date|select|boolean, options?, required?}]\`. Nome único. ${ADMIN_ACCESS}`,
    consent: true,
    body: CreateSdConfigItemTypeSchema,
    responses: { 201: { description: 'Criado.', schema: SdConfigItemTypeDTO } },
    errors: [
      ...ADMIN_ERRORS,
      { code: 'SD_CONFIG_CONFLICT', when: 'Nome já usado' },
    ],
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/servicedesk/config-item-types/{typeId}',
    tags: [CMDB],
    summary: 'Atualizar tipo de item',
    description: `Mudar o esquema não reescreve os itens; os atributos são revalidados na próxima edição. ${ADMIN_ACCESS}`,
    params: TYPE_ID,
    consent: true,
    body: UpdateSdConfigItemTypeSchema,
    responses: {
      200: { description: 'Atualizado.', schema: SdConfigItemTypeDTO },
    },
    errors: [
      ...ADMIN_ERRORS,
      'SD_CONFIG_ITEM_TYPE_NOT_FOUND',
      { code: 'SD_CONFIG_CONFLICT', when: 'Nome já usado' },
    ],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/servicedesk/config-item-types/{typeId}',
    tags: [CMDB],
    summary: 'Excluir tipo de item',
    description: `Os itens do tipo ficam sem tipo. ${ADMIN_ACCESS}`,
    params: TYPE_ID,
    consent: true,
    responses: { 200: { description: 'Excluído.', schema: null } },
    errors: [...ADMIN_ERRORS, 'SD_CONFIG_ITEM_TYPE_NOT_FOUND'],
  },

  /* --------------------------- itens de config ----------------------------- */
  {
    method: 'get',
    path: '/workspaces/{id}/servicedesk/config-items',
    tags: [CMDB],
    summary: 'Listar itens de configuração',
    description: `Paginado. Filtros por tipo, status, criticidade, cliente, departamento, pai e garantia vencendo em N dias; \`q\` busca em nome, código, série, fabricante, modelo, local e IP. ${access('sd-config-items', 'VIEW')}`,
    query: ListSdConfigItemsSchema,
    responses: {
      200: { description: 'Página.', schema: sdPage(SdConfigItemDTO) },
    },
    errors: AGENT_ERRORS,
  },
  {
    method: 'post',
    path: '/workspaces/{id}/servicedesk/config-items',
    tags: [CMDB],
    summary: 'Criar item de configuração',
    description: `\`attributes\` é validado contra o esquema do tipo. ${CUSTOM_FIELDS_NOTE} ${access('sd-config-items', 'CREATE')}`,
    consent: true,
    body: CreateSdConfigItemSchema,
    responses: { 201: { description: 'Criado.', schema: SdConfigItemDTO } },
    errors: [...AGENT_ERRORS, ...CI_REF_ERRORS],
  },
  {
    method: 'get',
    path: '/workspaces/{id}/servicedesk/config-items/options',
    tags: [CMDB],
    summary: 'Seletor de itens de configuração',
    description: `Busca leve (exceto aposentados), opcionalmente só de um cliente; \`excludeId\` para o seletor de item pai. ${access('sd-config-items', 'VIEW')}`,
    query: SdConfigItemOptionsSchema,
    responses: {
      200: { description: 'Opções.', schema: z.array(SdOptionDTO) },
    },
    errors: AGENT_ERRORS,
  },
  {
    method: 'get',
    path: '/workspaces/{id}/servicedesk/config-items/{itemId}',
    tags: [CMDB],
    summary: 'Detalhar item de configuração',
    description: `Inclui a cadeia de pais, os filhos diretos e os 10 chamados mais recentes. ${access('sd-config-items', 'VIEW')}`,
    params: ITEM_ID,
    responses: {
      200: { description: 'Item.', schema: SdConfigItemDetailDTO },
    },
    errors: [...AGENT_ERRORS, 'SD_CONFIG_ITEM_NOT_FOUND'],
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/servicedesk/config-items/{itemId}',
    tags: [CMDB],
    summary: 'Atualizar item de configuração',
    description: `${CLEARABLE} Trocar o tipo sem enviar \`attributes\` aproveita os atributos compatíveis. ${access('sd-config-items', 'EDIT')}`,
    params: ITEM_ID,
    consent: true,
    body: UpdateSdConfigItemSchema,
    responses: { 200: { description: 'Atualizado.', schema: SdConfigItemDTO } },
    errors: [
      ...AGENT_ERRORS,
      ...CI_REF_ERRORS,
      {
        code: 'SD_CONFIG_ITEM_CYCLE',
        when: 'O pai é o próprio item ou um descendente',
      },
    ],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/servicedesk/config-items/{itemId}',
    tags: [CMDB],
    summary: 'Excluir item de configuração',
    description: `Exclusão lógica; os filhos passam para o pai do item. ${access('sd-config-items', 'DELETE')}`,
    params: ITEM_ID,
    consent: true,
    responses: { 200: { description: 'Excluído.', schema: null } },
    errors: [...AGENT_ERRORS, 'SD_CONFIG_ITEM_NOT_FOUND'],
  },
]
