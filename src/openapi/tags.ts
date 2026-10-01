/**
 * Tags da documentação, agrupadas (`x-tagGroups`, suportado pelo Scalar).
 * A ordem aqui é a ordem da navegação em /reference. Só entram no
 * documento as tags com ao menos uma operação registrada.
 */

interface TagGroupDefinition {
  readonly name: string
  readonly tags: readonly {
    readonly name: string
    readonly description: string
  }[]
}

export const TAG_GROUPS = [
  {
    name: 'Conta',
    tags: [
      {
        name: 'Autenticação',
        description:
          'Cadastro, login, sessão, OTP por e-mail e dois fatores. Servido pelo [Better Auth](https://www.better-auth.com/docs) em `/api/auth/*` — respostas fora do envelope padrão.',
      },
      {
        name: 'Usuário',
        description: 'Perfil, mídia e preferências do usuário autenticado.',
      },
      {
        name: 'Privacidade (LGPD)',
        description:
          'Consentimento de cookies, exportação e exclusão de dados (LGPD, art. 18).',
      },
    ],
  },
  {
    name: 'Workspaces',
    tags: [
      {
        name: 'Workspaces',
        description:
          'Criação, edição e exclusão de workspaces (tenant). Tudo no Steel é escopado por workspace.',
      },
      {
        name: 'Membros e convites',
        description:
          'Membros do workspace, convites por e-mail e aceite de convite.',
      },
      {
        name: 'Perfis de acesso',
        description:
          'Perfis de permissão (RBAC) do workspace: mapa `recurso → ações`.',
      },
      {
        name: 'Configurações do workspace',
        description:
          'Conexões com Postgres externo por módulo, ajustes de IA, feature flags e notificações in-app.',
      },
      {
        name: 'Projetos',
        description:
          'Projetos do workspace — criação, edição, arquivamento, favoritos, membros e convites.',
      },
    ],
  },
  {
    name: 'Cobrança',
    tags: [
      {
        name: 'Assinaturas',
        description:
          'Planos pagos via AbacatePay, cupons e o webhook de cobrança.',
      },
    ],
  },
  {
    name: 'CRM',
    tags: [
      {
        name: 'CRM · Leads',
        description:
          'Leads, qualificação, contatos, reuniões e roteamento/score.',
      },
      {
        name: 'CRM · Pessoas e empresas',
        description: 'Pessoas, empresas e campos personalizados.',
      },
      {
        name: 'CRM · Oportunidades',
        description: 'Oportunidades, itens de linha, pipelines e etapas.',
      },
      {
        name: 'CRM · Propostas',
        description:
          'Propostas comerciais, templates e métricas de visualização.',
      },
      { name: 'CRM · Produtos', description: 'Catálogo de produtos.' },
      {
        name: 'CRM · Atividades e tarefas',
        description: 'Atividades, tarefas, notas e eventos de calendário.',
      },
      {
        name: 'CRM · Forecast e cotas',
        description: 'Previsão de vendas e cotas por vendedor.',
      },
      {
        name: 'CRM · Relatórios e dashboards',
        description: 'Relatórios e dashboards configuráveis.',
      },
      {
        name: 'CRM · E-mail marketing',
        description:
          'Campanhas, templates, listas, descadastros e contas de e-mail sincronizadas.',
      },
      {
        name: 'CRM · Formulários e landing pages',
        description: 'Formulários e landing pages (gestão interna).',
      },
      {
        name: 'CRM · Workflows',
        description: 'Automação de workflows: definição, versões e execuções.',
      },
      {
        name: 'CRM · Redes sociais',
        description:
          'Conexões sociais, posts agendados, tendências e concorrentes.',
      },
      {
        name: 'CRM · IA',
        description: 'Assistente de IA do CRM e Hook Vault.',
      },
      {
        name: 'CRM · Integrações',
        description: 'Chaves de API de integração (gestão interna).',
      },
      {
        name: 'CRM · Configurações',
        description: 'Configurações e membros do módulo CRM.',
      },
    ],
  },
  {
    name: 'Comunicação',
    tags: [
      {
        name: 'Comunicação · Conversas',
        description:
          'Conversas e mensagens do WhatsApp, atribuição e fechamento.',
      },
      { name: 'Comunicação · Contatos', description: 'Contatos do WhatsApp.' },
      { name: 'Comunicação · Grupos', description: 'Grupos do WhatsApp.' },
      {
        name: 'Comunicação · Transmissões',
        description: 'Transmissões (broadcasts) e importação de destinatários.',
      },
      {
        name: 'Comunicação · Templates e respostas rápidas',
        description: 'Templates aprovados pela Meta e respostas rápidas.',
      },
      {
        name: 'Comunicação · Conexões',
        description: 'Conexões com a Meta Cloud API e a Z-API.',
      },
      {
        name: 'Comunicação · IA',
        description: 'Atendimento por IA e base de conhecimento.',
      },
      {
        name: 'Comunicação · Dashboards e relatórios',
        description: 'Dashboards e relatórios de atendimento.',
      },
      {
        name: 'Comunicação · Configurações',
        description:
          'Configurações de atendimento, mídia e membros atribuíveis.',
      },
      {
        name: 'Comunicação · Tempo real e webhooks',
        description: 'SSE de eventos e webhooks de entrada da Meta e da Z-API.',
      },
    ],
  },
  {
    name: 'ServiceDesk',
    tags: [
      {
        name: 'ServiceDesk · Chamados',
        description:
          'Chamados ITIL (incidente, requisição, mudança, problema): abertura, quadro kanban, fases, SLA, participantes, escalonamento, rastreabilidade e tempo real. Agentes veem todos; solicitantes só os próprios.',
      },
      {
        name: 'ServiceDesk · Histórico e anexos',
        description:
          'Chat do chamado: mensagens públicas e notas internas (só agentes), edição/exclusão pelo autor em até 15 minutos e anexos (imagem, vídeo, áudio, documento — até 25 MB, bucket privado servido por rota autenticada).',
      },
      {
        name: 'ServiceDesk · Execução do atendimento',
        description:
          'Tarefas com responsável, prazo e ordem; custos por categoria (faturável ou não); peças do catálogo ou texto livre com fluxo de status e baixa de estoque. Só agentes.',
      },
      {
        name: 'ServiceDesk · Aprovações e assinaturas',
        description:
          'Pedidos de aprovação por e-mail com link público (token de uso único guardado como SHA-256; a primeira resposta decide) e assinaturas digitais (PNG + SHA-256 da imagem e de um snapshot do chamado).',
      },
      {
        name: 'ServiceDesk · Visões salvas',
        description:
          'Filtros, colunas e modo (kanban/lista/tabela) salvos do quadro de chamados — pessoais ou compartilhados.',
      },
      {
        name: 'ServiceDesk · Base de conhecimento',
        description:
          'Artigos (árvore, rascunho/publicado, interno/portal, categoria, tags), busca, votos de utilidade, comentários do editor, mídia e vínculo com chamados.',
      },
      {
        name: 'ServiceDesk · Configurações',
        description:
          'Configuração do ServiceDesk (ITIL 4): geral, departamentos, catálogo, classificações, impacto/urgência/prioridade/severidade e matriz, fluxos (fases e transições), calendários, SLA/OLA, escalonamento, automações, campos customizados, modelos, respostas prontas e peças.',
      },
      {
        name: 'ServiceDesk · Clientes e contatos',
        description:
          'Cadastro de clientes e empresas (CPF/CNPJ validado, endereço via ViaCEP) e seus contatos. Só agentes (membros de um departamento) e admins do ServiceDesk.',
      },
      {
        name: 'ServiceDesk · Portal do contato',
        description:
          'Portal público do contato do cliente (`/suporte`): link mágico por e-mail (token SHA-256, 7 dias, uso único), sessão própria de 12 horas no cookie `sd.portal_session` (sem Better Auth), lista e abertura de chamados, conversa com anexo, avaliação do atendimento e a base de conhecimento publicada. Tudo filtrado no service pelo contato e pelas empresas dele.',
      },
      {
        name: 'ServiceDesk · Painéis',
        description:
          'Painéis customizáveis (motor de dashboards com fontes de chamados, custos, eventos e artigos): contagem, soma, média, % de SLA, MTTR, backlog, criados × resolvidos, CSAT. Padrões "Dashboard analítico" e "KPIs (TV)"; modo TV em tela cheia. Só agentes.',
      },
      {
        name: 'ServiceDesk · WhatsApp',
        description:
          'Conexões de WhatsApp próprias do módulo (Z-API ou Meta Cloud API, credenciais cifradas, webhook e teste), conversas do ServiceDesk e a aba WhatsApp do chamado: vincular/iniciar/desvincular, janela de 24 h da Meta, envio de texto, arquivo e modelo aprovado — tudo espelhado no histórico do chamado.',
      },
      {
        name: 'ServiceDesk · Agente de IA',
        description:
          'Copiloto do agente (resumo, sugestão de resposta, classificação, rascunho da solução e conversa livre sobre o chamado) e pré-atendimento do solicitante (portal e WhatsApp): resolve pela base de conhecimento ou abre o chamado já triado. Usa o provedor e a cota de IA do workspace (ADR 0007); o contexto enviado vai com dados pessoais mascarados.',
      },
      {
        name: 'ServiceDesk · CMDB',
        description:
          'Itens de configuração (CMDB) com hierarquia, atributos por tipo, garantia e chamados vinculados; tipos de item customizáveis.',
      },
    ],
  },
  {
    name: 'Páginas públicas do CRM',
    tags: [
      {
        name: 'CRM público · Formulários',
        description:
          'Formulários publicados — leitura e envio por visitantes, sem sessão (o `publicToken` é o acesso).',
      },
      {
        name: 'CRM público · Propostas',
        description:
          'Proposta compartilhada com o cliente: leitura, registro de visualização e aceite (o `shareToken` é o acesso).',
      },
      {
        name: 'CRM público · Landing pages',
        description:
          'Landing pages publicadas e registro de visualizações (o `shareToken` é o acesso).',
      },
      {
        name: 'CRM público · Integrações',
        description:
          'API de entrada de leads para sistemas externos, autenticada por chave de API do workspace.',
      },
      {
        name: 'CRM público · Workflows',
        description:
          'Gatilho de workflow por webhook (o `webhookToken` é o acesso).',
      },
      {
        name: 'CRM público · Descadastro',
        description:
          'Descadastro LGPD de campanhas de e-mail, incluindo o one-click do RFC 8058.',
      },
    ],
  },
  {
    name: 'Plataforma',
    tags: [
      {
        name: 'Status',
        description:
          'Página de status pública e coleta de health checks dos componentes.',
      },
      {
        name: 'Comercial',
        description: 'Formulário "Fale com vendas" do site.',
      },
      {
        name: 'Redes sociais (OAuth e mídia)',
        description:
          'Callback OAuth das redes sociais do CRM e blobs temporários servidos às APIs das redes.',
      },
    ],
  },
  {
    name: 'Admin global',
    tags: [
      {
        name: 'Admin · Workspaces',
        description:
          'Gestão de qualquer workspace pelo admin da plataforma: detalhe, membros, perfis, módulos, features, plano, suspensão e exclusão.',
      },
      {
        name: 'Admin · Backups e operações',
        description:
          'Backups FULL/por workspace, download assinado, restauração e acompanhamento de operações assíncronas.',
      },
      {
        name: 'Admin · Métricas',
        description: 'Visão geral e métricas de uso da plataforma.',
      },
      {
        name: 'Admin · Changelog',
        description:
          'E-mails de novidades (changelog) para usuários: rascunho, destinatários e disparo.',
      },
    ],
  },
  {
    name: 'Legado (Nexo)',
    tags: [
      {
        name: 'Sticky Notes',
        description:
          'Notas rápidas pessoais. **Legado da base Nexo** — mantido por compatibilidade, sem evolução planejada.',
      },
      {
        name: 'Links Curtos',
        description:
          'Links salvos do usuário. **Legado da base Nexo** — mantido por compatibilidade, sem evolução planejada.',
      },
    ],
  },
] as const satisfies readonly TagGroupDefinition[]

export type TagName = (typeof TAG_GROUPS)[number]['tags'][number]['name']
