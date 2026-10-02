import { describe, expect, it } from 'vitest'
import { createFakeSdAiCatalog } from '@/src/__tests__/factories/sd-ai.factory'
import {
  buildSdCopilotSystem,
  buildSdPreServiceSystem,
  buildSdTriageSystem,
  clipSdText,
  formatSdCatalog,
  formatSdKbContext,
  formatSdTicketContext,
  redactSdPii,
  SD_AI_DEFAULT_HANDOFF_KEYWORDS,
  SD_AI_LOW_CONFIDENCE,
  type SdAiTicketContext,
  sdAiSearchTerms,
  sdAiTranscript,
  sdHandoffRequested,
} from '@/src/lib/servicedesk/ai-prompts'

const persona = { aiPersona: null, aiInstructions: null }

function ticketContext(
  overrides: Partial<SdAiTicketContext> = {},
): SdAiTicketContext {
  return {
    code: 'INC-000001',
    type: 'Incidente',
    title: 'VPN fora do ar',
    description: 'Ninguém conecta',
    phase: 'Em andamento',
    priority: null,
    category: null,
    department: null,
    solution: null,
    messages: [],
    ...overrides,
  }
}

describe('redactSdPii', () => {
  it('mascara e-mail, CNPJ, CPF e telefone', () => {
    expect(redactSdPii('fale com ana@acme.com.br')).toBe('fale com [e-mail]')
    expect(redactSdPii('CNPJ 12.345.678/0001-99')).toBe('CNPJ [documento]')
    expect(redactSdPii('CPF 123.456.789-00')).toBe('CPF [documento]')
    expect(redactSdPii('ligue (11) 98888-7777')).toBe('ligue [telefone]')
  })

  it('deixa o texto comum intacto', () => {
    expect(redactSdPii('a VPN caiu de novo')).toBe('a VPN caiu de novo')
  })
})

describe('clipSdText', () => {
  it('apara o texto e corta com reticências acima do limite', () => {
    expect(clipSdText('  curto  ', 20)).toBe('curto')
    expect(clipSdText('abcdefghij', 5)).toBe('abcd…')
  })
})

describe('sdHandoffRequested', () => {
  it('reconhece as palavras padrão sem depender de acento ou caixa', () => {
    expect(SD_AI_DEFAULT_HANDOFF_KEYWORDS).toContain('atendente')
    expect(sdHandoffRequested('quero falar com ALGUÉM', [])).toBe(true)
    expect(sdHandoffRequested('me passa pro Atendente', [])).toBe(true)
  })

  it('aceita palavras extras do workspace e ignora as vazias', () => {
    expect(
      sdHandoffRequested('preciso de suporte N2', ['  suporte n2  ']),
    ).toBe(true)
    expect(sdHandoffRequested('tudo certo por aqui', ['   ', ''])).toBe(false)
  })
})

describe('formatSdTicketContext', () => {
  it('monta o cabeçalho completo e o histórico em ordem cronológica', () => {
    const text = formatSdTicketContext(
      ticketContext({
        priority: 'Alta',
        category: 'Acesso > VPN',
        department: 'Suporte N1',
        solution: 'Reiniciado o concentrador',
        messages: [
          {
            role: 'solicitante',
            internal: false,
            body: 'não conecto',
            at: '2026-09-21T12:00:00.000Z',
          },
          {
            role: 'agente',
            internal: true,
            body: 'checar firewall',
            at: '2026-09-21T13:00:00.000Z',
          },
        ],
      }),
    )
    expect(text).toContain(
      'Chamado INC-000001 (Incidente) — fase: Em andamento',
    )
    expect(text).toContain('Prioridade: Alta')
    expect(text).toContain('Catálogo: Acesso > VPN')
    expect(text).toContain('Departamento: Suporte N1')
    expect(text).toContain('Solução registrada:\nReiniciado o concentrador')
    expect(text).toContain('[2026-09-21 12:00] solicitante: não conecto')
    expect(text).toContain(
      '[2026-09-21 13:00] agente (nota interna): checar firewall',
    )
    expect(text.indexOf('não conecto')).toBeLessThan(
      text.indexOf('checar firewall'),
    )
  })

  it('usa o marcador de descrição vazia e avisa quando não há histórico', () => {
    const text = formatSdTicketContext(ticketContext({ description: '' }))
    expect(text).toContain('(sem descrição)')
    expect(text).toContain('Histórico: (vazio)')
  })

  it('corta as mensagens mais antigas quando estoura o orçamento', () => {
    const messages = Array.from({ length: 30 }, (_, i) => ({
      role: 'agente' as const,
      internal: false,
      body: `${i}`.padEnd(1500, 'x'),
      at: `2026-09-21T12:${String(i).padStart(2, '0')}:00.000Z`,
    }))
    const text = formatSdTicketContext(ticketContext({ messages }))
    expect(text).toContain('[2026-09-21 12:29]')
    expect(text).not.toContain('[2026-09-21 12:00]')
  })
})

describe('formatSdKbContext', () => {
  it('avisa quando não há artigos', () => {
    expect(formatSdKbContext([])).toBe(
      'Base de conhecimento: nenhum artigo relevante encontrado.',
    )
  })

  it('cita os artigos pelo id e mascara dados pessoais', () => {
    const text = formatSdKbContext([
      { id: 'a1', title: 'VPN', plainText: 'escreva para vpn@acme.com' },
    ])
    expect(text).toContain('### [a1] VPN')
    expect(text).toContain('[e-mail]')
  })

  it('para de incluir artigos quando o orçamento acaba', () => {
    const articles = Array.from({ length: 5 }, (_, i) => ({
      id: `a${i}`,
      title: `Gigante ${i}`,
      plainText: 'x'.repeat(4000),
    }))
    const text = formatSdKbContext(articles)
    expect(text).toContain('[a0]')
    expect(text).toContain('[a3]')
    expect(text).not.toContain('[a4]')
  })
})

describe('formatSdCatalog', () => {
  it('lista cada dimensão com o id e marca as vazias', () => {
    const text = formatSdCatalog(
      createFakeSdAiCatalog({ departments: [], impacts: [] }),
    )
    expect(text).toContain('cat | CATEGORY | - | Acesso')
    expect(text).toContain('sub | SUBCATEGORY | cat | VPN')
    expect(text).toContain('Departamentos (id | nome):\n(nenhum)')
    expect(text).toContain('Impactos (id | nível | nome):\n(nenhum)')
  })
})

describe('system prompts', () => {
  it('monta o copiloto com a tarefa, o chamado e a base', () => {
    const prompt = buildSdCopilotSystem('summary', persona, {
      ticket: 'CONTEXTO',
      kb: 'BASE',
    })
    expect(prompt).toContain('auxiliando um AGENTE')
    expect(prompt).toContain('Tarefa: resuma o chamado')
    expect(prompt).toContain('CONTEXTO')
    expect(prompt).toContain('BASE')
  })

  it.each(['reply', 'solution', 'chat'] as const)(
    'tem instrução própria para a tarefa %s',
    (task) => {
      const prompt = buildSdCopilotSystem(task, persona, {
        ticket: 't',
        kb: 'k',
      })
      expect(prompt).toContain('Tarefa: ')
      expect(prompt).not.toContain('Tarefa: resuma o chamado')
    },
  )

  it('inclui persona e instruções do workspace quando preenchidas', () => {
    const prompt = buildSdCopilotSystem(
      'chat',
      { aiPersona: '  Sou a Ana  ', aiInstructions: '  Seja breve  ' },
      { ticket: 't', kb: 'k' },
    )
    expect(prompt).toContain('Persona: Sou a Ana')
    expect(prompt).toContain('Instruções do time')
    expect(prompt).toContain('Seja breve')
  })

  it('ignora persona e instruções em branco', () => {
    const prompt = buildSdCopilotSystem(
      'chat',
      { aiPersona: '   ', aiInstructions: '' },
      { ticket: 't', kb: 'k' },
    )
    expect(prompt).not.toContain('Persona:')
    expect(prompt).not.toContain('Instruções do time')
  })

  it('manda o catálogo inteiro na triagem', () => {
    const prompt = buildSdTriageSystem(createFakeSdAiCatalog())
    expect(prompt).toContain('faça a triagem do chamado')
    expect(prompt).toContain('Catálogo (id | nível | pai | nome)')
    expect(prompt).toContain('dep | Suporte N1')
  })

  it('monta o pré-atendimento do portal com catálogo e tipos permitidos', () => {
    const prompt = buildSdPreServiceSystem({
      ...persona,
      channel: 'portal',
      ticketTypes: ['INCIDENT', 'SERVICE_REQUEST'],
      catalog: createFakeSdAiCatalog(),
      kb: 'BASE',
    })
    expect(prompt).toContain('portal do solicitante')
    expect(prompt).toContain('INCIDENT, SERVICE_REQUEST')
    expect(prompt).toContain('Urgências (id | nível | nome)')
    expect(prompt).toContain('BASE')
  })

  it('marca o canal WhatsApp e o catálogo vazio', () => {
    const prompt = buildSdPreServiceSystem({
      ...persona,
      channel: 'whatsapp',
      ticketTypes: ['INCIDENT'],
      catalog: { categories: [], urgencies: [] },
      kb: 'BASE',
    })
    expect(prompt).toContain('Canal: WhatsApp')
    expect(prompt).toContain('(nenhum)')
    expect(prompt).toContain('(nenhuma)')
  })

  it('troca o objetivo e some com o catálogo quando já existe chamado aberto', () => {
    const prompt = buildSdPreServiceSystem({
      ...persona,
      channel: 'whatsapp',
      ticketTypes: ['INCIDENT'],
      catalog: createFakeSdAiCatalog(),
      kb: 'BASE',
      ticketOpen: { code: 'INC-000009', title: 'VPN do ana@acme.com' },
    })
    expect(prompt).toContain('já tem o chamado INC-000009')
    expect(prompt).toContain('[e-mail]')
    expect(prompt).not.toContain('Catálogo (id | nível | pai | nome)')
  })
})

describe('sdAiTranscript', () => {
  it('rotula cada turno e apara o conteúdo', () => {
    expect(
      sdAiTranscript([
        { role: 'user', content: '  sem acesso  ' },
        { role: 'assistant', content: 'tente reiniciar' },
      ]),
    ).toBe('Solicitante: sem acesso\n\nAssistente: tente reiniciar')
  })
})

describe('sdAiSearchTerms', () => {
  it('prioriza o relato mais recente, tira stopwords e repetições', () => {
    expect(
      sdAiSearchTerms(['preciso de ajuda com a VPN', 'erro 809 na vpn']),
    ).toEqual(['vpn', '809', 'erro'])
  })

  it('devolve vazio sem palavras úteis e respeita o limite', () => {
    expect(sdAiSearchTerms(['!! ?? ..'])).toEqual([])
    expect(sdAiSearchTerms(['um dois tres quatro cinco seis'], 2)).toHaveLength(
      2,
    )
  })
})

describe('SD_AI_LOW_CONFIDENCE', () => {
  it('é o limiar abaixo do qual a IA prefere abrir chamado', () => {
    expect(SD_AI_LOW_CONFIDENCE).toBe(0.4)
  })
})
