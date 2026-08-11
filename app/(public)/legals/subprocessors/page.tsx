import type { Metadata } from 'next'
import { H1 } from '@/components/typography/heading/h1'
import { Muted } from '@/components/typography/text/muted'
import { P } from '@/components/typography/text/p'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PRIVACY_VERSION } from '@/lib/legal/versions'

export const metadata: Metadata = {
  title: 'Subprocessadores | Steel',
  description: 'Terceiros que processam dados em nome do Steel.',
}

const SUBPROCESSORS = [
  {
    name: 'Meta Platforms, Inc.',
    purpose:
      'WhatsApp Business Platform (mensageria), Facebook e Instagram (conexões de redes sociais do CRM)',
    data: 'Mensagens de WhatsApp, contatos, dados de conexão OAuth',
    location: 'Estados Unidos',
  },
  {
    name: 'Z-API',
    purpose: 'Gateway alternativo (não oficial) de WhatsApp',
    data: 'Mensagens de WhatsApp, contatos',
    location: 'Brasil',
  },
  {
    name: 'Google LLC',
    purpose:
      'Login social, Google Ads e Google Analytics (conexões de marketing do CRM)',
    data: 'Nome, e-mail (login); dados de campanhas e métricas (Ads/Analytics)',
    location: 'Estados Unidos',
  },
  {
    name: 'GitHub, Inc. (Microsoft)',
    purpose: 'Login social',
    data: 'Nome, e-mail',
    location: 'Estados Unidos',
  },
  {
    name: 'TikTok',
    purpose: 'Conexão de rede social do CRM',
    data: 'Dados de conexão OAuth, conteúdo publicado/agendado',
    location: 'Estados Unidos / Singapura',
  },
  {
    name: 'LinkedIn Corporation (Microsoft)',
    purpose: 'Conexão de rede social do CRM',
    data: 'Dados de conexão OAuth, conteúdo publicado/agendado',
    location: 'Estados Unidos',
  },
  {
    name: 'X Corp.',
    purpose: 'Conexão de rede social do CRM',
    data: 'Dados de conexão OAuth, conteúdo publicado/agendado',
    location: 'Estados Unidos',
  },
  {
    name: 'YouTube (Google LLC)',
    purpose: 'Conexão de rede social do CRM',
    data: 'Dados de conexão OAuth, métricas de canal',
    location: 'Estados Unidos',
  },
  {
    name: 'OpenAI, L.L.C.',
    purpose:
      'Recursos de inteligência artificial (assistente de IA, resposta automática, análise de sentimento)',
    data: 'Conteúdo de conversas e prompts submetidos pelo usuário',
    location: 'Estados Unidos',
  },
  {
    name: 'Anthropic, PBC',
    purpose:
      'Recursos de inteligência artificial (assistente de IA, resposta automática, análise de sentimento)',
    data: 'Conteúdo de conversas e prompts submetidos pelo usuário',
    location: 'Estados Unidos',
  },
  {
    name: 'AbacatePay',
    purpose: 'Processamento de pagamentos e cobrança de assinaturas',
    data: 'Nome, endereço de cobrança, dados de cartão',
    location: 'Brasil',
  },
  {
    name: 'Resend',
    purpose: 'Envio de e-mails transacionais',
    data: 'Nome, e-mail, conteúdo da mensagem transacional',
    location: 'Estados Unidos',
  },
  {
    name: 'Axiom',
    purpose: 'Observabilidade, logs e auditoria de eventos da plataforma',
    data: 'Logs técnicos, metadados de eventos de auditoria',
    location: 'Estados Unidos',
  },
  {
    name: 'Open Datacenter Brasil Ltda',
    purpose:
      'Hospedagem da aplicação, banco de dados e armazenamento de arquivos',
    data: 'Todos os dados processados pela plataforma',
    location: 'Brasil',
  },
] as const

export default function SubprocessorsPage() {
  return (
    <main className='mx-auto flex max-w-4xl flex-col gap-6 px-6 py-16'>
      <header className='flex flex-col gap-2 text-left'>
        <H1 className='text-left'>Subprocessadores</H1>
        <Muted>Versão {PRIVACY_VERSION}</Muted>
      </header>

      <P>
        Esta página lista os terceiros ("subprocessadores") que processam dados
        pessoais em nome do Steel, referenciada pela nossa{' '}
        <a href='/legals/privacy' className='underline'>
          Política de Privacidade
        </a>
        . Notificaremos alterações materiais a esta lista conforme descrito lá.
      </P>

      <div className='overflow-x-auto'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subprocessador</TableHead>
              <TableHead>Finalidade</TableHead>
              <TableHead>Dados processados</TableHead>
              <TableHead>Localização</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SUBPROCESSORS.map((sp) => (
              <TableRow key={sp.name}>
                <TableCell className='font-medium'>{sp.name}</TableCell>
                <TableCell>{sp.purpose}</TableCell>
                <TableCell>{sp.data}</TableCell>
                <TableCell>{sp.location}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </main>
  )
}
