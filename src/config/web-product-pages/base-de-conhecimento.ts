import {
  Comment01Icon,
  HierarchyIcon,
  Link01Icon,
  Search01Icon,
  Tag01Icon,
  ThumbsUpIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import type { ProductPage } from '@/src/schemas/web-product-page.schema'

export const knowledgeBasePage: ProductPage = {
  slug: 'base-de-conhecimento',
  kind: 'feature',
  template: 'object',
  label: 'Base de conhecimento',
  meta: {
    title: 'Base de conhecimento com KCS | Steel',
    description:
      'Artigos escritos a partir dos chamados, com rascunho da IA, revisão, validade e métrica de reuso. Internos para o time ou públicos no portal.',
  },
  hero: {
    eyebrow: 'Base de conhecimento',
    title: 'O que o time aprende num chamado, o próximo já encontra pronto',
    subtitle:
      'Uma base de conhecimento no método KCS: o artigo nasce do atendimento, passa por revisão, tem data para ser revisto e mostra quantas vezes resolveu um caso.',
    window: {
      title: 'ServiceDesk',
      nav: ['Chamados', 'Base de conhecimento', 'Em revisão', 'Painéis'],
      active: 1,
      body: {
        kind: 'article',
        title: 'Reiniciar túnel IPsec da filial',
        tag: 'Publicado · interno',
        lines: ['Sintoma', 'Causa', 'Solução'],
        checklist: [
          { label: 'Acessar o firewall da filial', done: true },
          { label: 'Reiniciar a fase 2 do túnel', done: true },
          { label: 'Validar o ping até a matriz', done: false },
        ],
      },
      aside: {
        kind: 'fields',
        title: 'Sobre o artigo',
        chips: [{ label: 'KCS', tone: 'brand' }],
        rows: [
          { label: 'Reuso', value: 'Resolveu 14 chamados' },
          { label: 'Útil', value: '23 de 25 votos', tone: 'success' },
          { label: 'Próxima revisão', value: 'em 42 dias' },
          { label: 'Visibilidade', value: 'Interno' },
        ],
      },
    },
  },
  highlights: {
    eyebrow: 'Dentro de cada artigo',
    title: 'Não é um wiki esquecido. É conhecimento com dono e validade.',
    subtitle:
      'Editor rico, estrutura KCS, revisão e o vínculo com os chamados que o artigo resolveu.',
    items: [
      {
        title: 'Editor de verdade',
        description:
          'Títulos, listas, tabelas, código e imagens num editor rico, com os artigos organizados em árvore e por categoria.',
        visual: {
          kind: 'article',
          title: 'Configurar a VPN em casa',
          lines: ['Antes de começar', 'Passo a passo'],
        },
      },
      {
        title: 'Revisão antes de publicar',
        description:
          'O artigo vai para "Em revisão", um revisor aprova ou pede ajustes, e só então ele é publicado.',
        visual: {
          kind: 'timeline',
          items: [
            {
              actor: 'IA',
              action: 'rascunhou a partir do INC-1042',
              time: 'seg',
            },
            { actor: 'Ana', action: 'enviou para revisão', time: 'seg' },
            { actor: 'Bruno', action: 'pediu ajustes', time: 'ter' },
            { actor: 'Bruno', action: 'aprovou e publicou', time: 'qua' },
          ],
        },
      },
      {
        title: 'Validade e reuso',
        description:
          'Cada artigo pode ter intervalo de revisão. Os vencidos aparecem para a curadoria, e o reuso conta quantos chamados ele resolveu.',
        visual: {
          kind: 'list',
          title: 'Curadoria',
          items: [
            {
              label: 'Reiniciar túnel IPsec',
              meta: 'Usado 14×',
              tone: 'success',
            },
            {
              label: 'Trocar toner da impressora',
              meta: 'Revisão vencida',
              tone: 'warning',
            },
            {
              label: 'Cadastro no ERP antigo',
              meta: 'Sem uso há 6 meses',
              tone: 'neutral',
            },
          ],
        },
      },
    ],
  },
  ai: {
    eyebrow: 'KCS com IA',
    title: 'A IA faz o primeiro rascunho, o time decide o que publica',
    items: [
      {
        title: 'Artigo a partir do chamado',
        description:
          'Ao resolver algo novo, a IA monta o rascunho no esqueleto KCS — sintoma, causa e solução — a partir do histórico do chamado.',
        visual: {
          kind: 'article',
          title: 'Impressora não imprime frente e verso',
          tag: 'Rascunho da IA',
          lines: ['Sintoma', 'Causa', 'Solução'],
        },
      },
      {
        title: 'Sugestões de rascunho',
        description:
          'Chamados resolvidos sem artigo vinculado viram sugestões para a curadoria transformar em conhecimento.',
        visual: {
          kind: 'list',
          title: 'Chamados sem artigo',
          items: [
            {
              label: 'INC-1031 · E-mail não sincroniza',
              meta: 'Rascunhar',
              tone: 'brand',
            },
            {
              label: 'INC-1019 · Certificado expirado',
              meta: 'Rascunhar',
              tone: 'brand',
            },
          ],
        },
      },
      {
        title: 'Copiloto consulta a base',
        description:
          'Dentro do chamado, o copiloto busca os artigos certos para sugerir a solução.',
        visual: {
          kind: 'chat',
          messages: [
            {
              from: 'ai',
              text: 'O artigo "Reiniciar túnel IPsec" resolveu 14 casos parecidos.',
            },
          ],
        },
      },
      {
        title: 'Pré-atendimento usa os artigos do portal',
        description:
          'A IA do portal responde o solicitante com os artigos públicos antes de abrir chamado.',
        visual: {
          kind: 'chat',
          messages: [
            { from: 'contact', text: 'Como configuro a VPN em casa?' },
            {
              from: 'ai',
              text: 'Siga o artigo "Configurar a VPN em casa", são 4 passos.',
            },
          ],
        },
      },
      {
        title: 'Aviso de revisão vencida',
        description:
          'Uma vez por dia, o Steel avisa os responsáveis pelos artigos que passaram da validade.',
        visual: {
          kind: 'stats',
          items: [
            { label: 'Revisões vencidas', value: '3', tone: 'warning' },
            { label: 'Em revisão', value: '5', tone: 'info' },
          ],
        },
      },
    ],
  },
  details: {
    eyebrow: 'Organização',
    title: 'Fácil de achar, fácil de manter',
    subtitle: 'Recursos que mantêm a base útil depois do primeiro mês.',
    items: [
      {
        title: 'Árvore de artigos',
        description:
          'Artigos dentro de artigos, para guias longos e manuais por produto.',
        icon: HierarchyIcon,
      },
      {
        title: 'Categorias e tags',
        description:
          'Organize por categoria e marque com tags para filtrar rápido.',
        icon: Tag01Icon,
      },
      {
        title: 'Interno ou portal',
        description:
          'Cada artigo é só do time ou aparece também no portal do solicitante.',
        icon: Search01Icon,
      },
      {
        title: 'Votos de utilidade',
        description: 'Quem lê diz se ajudou, e a nota orienta a curadoria.',
        icon: ThumbsUpIcon,
      },
      {
        title: 'Comentários',
        description:
          'O time comenta no artigo para sugerir melhorias sem editar direto.',
        icon: Comment01Icon,
      },
      {
        title: 'Vínculo com chamados',
        description:
          'O artigo usado fica ligado ao chamado, na aba Conhecimento.',
        icon: Link01Icon,
      },
    ],
  },
  connected: {
    eyebrow: 'Recursos conectados',
    title: 'Conhecimento que circula pelo atendimento',
    subtitle:
      'A base de conhecimento abastece o chamado, o portal e a IA ao mesmo tempo.',
    items: [
      {
        title: 'ServiceDesk',
        description:
          'Artigos sugeridos e vinculados direto na tela do chamado.',
        href: '/product/servicedesk',
        visual: {
          kind: 'fields',
          code: 'INC-1042',
          title: 'VPN da filial fora do ar',
          rows: [
            { label: 'Artigo usado', value: 'Reiniciar túnel IPsec' },
            { label: 'Resolvido em', value: '38 min', tone: 'success' },
          ],
        },
      },
      {
        title: 'Portal do solicitante',
        description:
          'Os artigos públicos viram a ajuda self-service do seu cliente.',
        href: '/features/portal-do-solicitante',
        visual: {
          kind: 'list',
          title: 'Ajuda',
          items: [
            { label: 'Como redefinir a senha do ERP', tone: 'brand' },
            { label: 'Configurar a VPN em casa', tone: 'neutral' },
          ],
        },
      },
      {
        title: 'Steel AI',
        description:
          'A Steel AI consulta a base de conhecimento para responder sobre os procedimentos do time.',
        href: '/product/steel-ai',
        visual: {
          kind: 'chat',
          messages: [
            { from: 'user', text: 'Qual o procedimento para queda de VPN?' },
            {
              from: 'ai',
              text: 'Pelo artigo "Reiniciar túnel IPsec": acessar o firewall, reiniciar a fase 2 e validar o ping.',
            },
          ],
        },
      },
    ],
  },
  cta: {
    title: 'Pare de resolver o mesmo problema duas vezes',
    subtitle:
      'A base de conhecimento vem com o ServiceDesk, pronta para receber o primeiro artigo.',
  },
}
