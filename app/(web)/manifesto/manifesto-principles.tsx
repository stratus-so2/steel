'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface PrincipleBlock {
  type: 'p' | 'quote'
  text: string
}

interface Principle {
  id: string
  number: string
  title: string
  blocks: PrincipleBlock[]
}

const PRINCIPLES: Principle[] = [
  {
    id: 'system-of-record',
    number: '01',
    title: 'Mantenha um único sistema de registro',
    blocks: [
      {
        type: 'p',
        text: 'Na maioria das empresas, o mesmo cliente existe em três lugares: o chamado na ferramenta de suporte, a oportunidade no CRM e a conversa no WhatsApp de alguém. Cada time constrói a sua versão da verdade, e ninguém enxerga a história inteira.',
      },
      { type: 'quote', text: 'Conhecer o cliente deveria ser barato.' },
      {
        type: 'p',
        text: 'O Steel trata service desk, relacionamento e conversas como parte do mesmo workspace canônico: o contato que abre um chamado é o mesmo que está no funil e o mesmo que manda mensagem.',
      },
      {
        type: 'p',
        text: 'O ponto não é consolidar por consolidar. É tirar o custo de fragmentação que obriga a perguntar de novo o que o cliente já contou.',
      },
    ],
  },
  {
    id: 'guardrails-not-bureaucracy',
    number: '02',
    title: 'Siga o ITIL sem virar burocracia',
    blocks: [
      {
        type: 'p',
        text: 'Duas armadilhas se repetem nas ferramentas de atendimento. Uma dá liberdade total de configuração, e vira caos — cada fila inventa o próprio processo. A outra transforma o framework em formulário, e vira burocracia — o time passa mais tempo preenchendo campo do que resolvendo.',
      },
      {
        type: 'quote',
        text: 'O Steel é opinativo sobre guardrails, não sobre doutrina.',
      },
      {
        type: 'p',
        text: 'Incidente, requisição, mudança e problema seguem as práticas do ITIL 4, com matriz de impacto × urgência, SLA e aprovações. Mas fases, categorias, campos e automações são do seu time. Estrutura deveria limitar ambiguidade, não limitar quem atende.',
      },
    ],
  },
  {
    id: 'legible-for-machines',
    number: '03',
    title: 'Seja legível pra máquinas também',
    blocks: [
      {
        type: 'p',
        text: 'A IA muda a camada de interface do trabalho. Mas não muda a necessidade de algo canônico por baixo. Se o histórico do cliente está espalhado em ferramentas que não conversam, um assistente não consegue raciocinar sobre ele — só consegue completar em cima dos buracos.',
      },
      {
        type: 'quote',
        text: 'IA que realmente ajuda depende de um sistema estruturado e inteligível.',
      },
      {
        type: 'p',
        text: 'Por isso o Steel AI trabalha sobre os mesmos dados que o time: chamados, base de conhecimento, oportunidades e conversas, com vínculos explícitos e histórico durável. Ele sugere triagem, rascunha respostas e artigos e executa ações — mas nada muda sem a confirmação de uma pessoa.',
      },
      {
        type: 'quote',
        text: 'O futuro do atendimento é humano e IA juntos. A IA propõe, o humano confirma.',
      },
    ],
  },
  {
    id: 'never-coerce-deployment',
    number: '04',
    title: 'Nunca use hospedagem como moeda de troca',
    blocks: [
      {
        type: 'p',
        text: 'Restrição de infraestrutura devia ser levada a sério como requisito de negócio, não como alavanca de venda. Produto que trava os seus dados atrás de uma decisão de hospedagem cria o incentivo errado: o time troca controle por recurso, e paga a dívida de segurança e conformidade anos depois.',
      },
      {
        type: 'quote',
        text: 'Política de residência de dados, escopo de auditoria e LGPD definem onde a informação pode ficar — não o inverso.',
      },
      {
        type: 'p',
        text: 'No Steel, um workspace pode apontar um módulo para o seu próprio banco PostgreSQL externo, com as credenciais criptografadas, e continuar usando a mesma plataforma. Exportação de dados, consentimento e trilha de auditoria fazem parte do produto, não de um plano à parte.',
      },
    ],
  },
  {
    id: 'scale-without-complexity',
    number: '05',
    title: 'Escale sem virar complexo',
    blocks: [
      {
        type: 'p',
        text: 'A maioria das ferramentas ganha escala adicionando superfície: módulo novo, papel novo, tela de administração nova. Em algum momento, a ferramenta vira uma função operacional própria — alguém precisa virar "especialista na ferramenta" só pra manter ela funcionando.',
      },
      { type: 'quote', text: 'Construímos pro time. Deixamos o time compor.' },
      {
        type: 'p',
        text: 'Escala devia nascer de composição, não de complexidade acumulada. Você liga só os módulos que usa, e os mesmos elementos — contatos, filas, pipelines, automações — continuam funcionando quando a operação cresce.',
      },
    ],
  },
  {
    id: 'operational-truth',
    number: '06',
    title: 'Mostre a verdade operacional em toda camada',
    blocks: [
      {
        type: 'p',
        text: 'A maioria das ferramentas de atendimento funciona bem pra quem está na fila, mas raramente serve a quem precisa enxergar a operação inteira.',
      },
      {
        type: 'quote',
        text: 'Visibilidade pra organização não devia ser um projeto paralelo — é função central do sistema.',
      },
      {
        type: 'p',
        text: 'Sem isso, alguém passa horas montando planilha que fica velha no dia seguinte. No Steel, o SLA é medido sobre o calendário útil de cada operação, os dashboards saem dos mesmos dados que o time usa, o modo TV deixa a fila visível na parede e os relatórios de SLA chegam agendados por e-mail. O retrato reflete o que está acontecendo, não o esforço de quem montou o relatório.',
      },
    ],
  },
]

const ACTIVE_ROOT_MARGIN = '-45% 0px -45% 0px'
// Mirrors the former `offset: ['start 0.8', 'start 0.3']`: the title starts
// filling when its top reaches 80% of the viewport and ends at 30%.
const FILL_START = 0.8
const FILL_END = 0.3

export function ManifestoPrinciples() {
  const [activeId, setActiveId] = useState(PRINCIPLES[0].id)

  useEffect(() => {
    const sections = PRINCIPLES.map((principle) =>
      document.getElementById(principle.id),
    ).filter((el): el is HTMLElement => el !== null)

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting)
        if (visible.length === 0) return
        const topMost = visible.reduce((a, b) =>
          a.boundingClientRect.top < b.boundingClientRect.top ? a : b,
        )
        setActiveId(topMost.target.id)
      },
      { rootMargin: ACTIVE_ROOT_MARGIN, threshold: 0 },
    )

    for (const section of sections) observer.observe(section)
    return () => observer.disconnect()
  }, [])

  return (
    <section className='mx-auto w-full px-4 sm:px-8 xl:px-11 xl:max-w-336 2xl:max-w-384 border-r border-l border-border py-16'>
      <div className='w-full px-5 py-16 md:px-9 grid gap-12 lg:grid-cols-[240px_1fr]'>
        <div className='space-y-6 lg:sticky lg:top-24 lg:self-start'>
          <div className='text-muted-foreground text-xs uppercase whitespace-nowrap font-medium font-mono tracking-[0.3em]'>
            princípios
          </div>
          <div className='space-y-4 border-l border-border pl-4'>
            {PRINCIPLES.map((principle) => (
              <a
                key={principle.id}
                href={`#${principle.id}`}
                className={cn(
                  'group relative flex items-center gap-3 text-sm text-muted-foreground transition-colors duration-300 ease-out before:absolute before:-left-[17px] before:top-0 before:h-full before:w-0.5 before:bg-brand-600 before:opacity-0 before:transition-opacity before:duration-300',
                  activeId === principle.id &&
                    'text-primary before:opacity-100',
                )}
              >
                <span className='w-6 font-mono text-xs font-semibold text-branding-600'>
                  {principle.number}
                </span>
                <span className='font-semibold'>{principle.title}</span>
              </a>
            ))}
          </div>
        </div>
        <div className='space-y-16'>
          {PRINCIPLES.map((principle) => (
            <PrincipleItem key={principle.id} principle={principle} />
          ))}
        </div>
      </div>
    </section>
  )
}

function useTitleFill(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const el = ref.current
      if (!el) return
      const top = el.getBoundingClientRect().top / window.innerHeight
      const raw = (FILL_START - top) / (FILL_START - FILL_END)
      const progress = Math.min(1, Math.max(0, raw))
      el.style.setProperty('--title-progress', progress.toString())
    }
    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame !== 0) cancelAnimationFrame(frame)
    }
  }, [ref])
}

function PrincipleItem({ principle }: { principle: Principle }) {
  const ref = useRef<HTMLDivElement>(null)
  useTitleFill(ref)
  const chars = [...principle.title]

  return (
    <div
      id={principle.id}
      ref={ref}
      className='scroll-mt-24 space-y-8'
      style={{ '--title-progress': 0 } as React.CSSProperties}
    >
      <div className='space-y-6'>
        <div className='flex flex-col gap-2'>
          <span className='text-h6 text-muted-foreground'>
            {principle.number}
          </span>
          <h2 className='font-normal text-5xl md:whitespace-pre-line'>
            {chars.map((char, index) => (
              <PrincipleTitleChar
                key={index}
                char={char}
                index={index}
                total={chars.length}
              />
            ))}
          </h2>
        </div>
        <div className='space-y-6 text-muted-foreground font-medium'>
          {principle.blocks.map((block) =>
            block.type === 'quote' ? (
              <p
                key={block.text}
                className='border-l-2 border-branding-600 pl-6 italic text-primary'
              >
                {block.text}
              </p>
            ) : (
              <p key={block.text}>{block.text}</p>
            ),
          )}
        </div>
      </div>
    </div>
  )
}

interface PrincipleTitleCharProps {
  char: string
  index: number
  total: number
}

function PrincipleTitleChar({ char, index, total }: PrincipleTitleCharProps) {
  // Each character fills over its own slice [index/total, (index+1)/total]
  // of the parent's --title-progress.
  const charProgress = `clamp(0%, calc((var(--title-progress) * ${total} - ${index}) * 100%), 100%)`

  return (
    <span
      style={{
        color: `color-mix(in oklch, var(--muted-foreground), var(--primary) ${charProgress})`,
      }}
    >
      {char}
    </span>
  )
}
