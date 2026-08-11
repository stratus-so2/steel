import type { Metadata } from 'next'
import { H1 } from '@/components/typography/heading/h1'
import { H2 } from '@/components/typography/heading/h2'
import { Muted } from '@/components/typography/text/muted'
import { P } from '@/components/typography/text/p'

export const metadata: Metadata = {
  title: 'Retenção de Dados | Steel',
  description: 'Por quanto tempo o Steel retém seus dados.',
}

export default function DataRetentionPage() {
  return (
    <main className='mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16'>
      <header className='flex flex-col gap-2 text-left'>
        <H1 className='text-left'>Retenção de Dados</H1>
        <Muted>Atualizado em 11 de agosto de 2026</Muted>
      </header>

      <P>
        Mantemos dados apenas pelo tempo necessário às finalidades descritas na{' '}
        <a href='/legals/privacy' className='underline'>
          Política de Privacidade
        </a>
        , à vigência da conta ou contratação, e ao cumprimento de obrigações
        legais.
      </P>

      <section className='flex flex-col gap-4'>
        <div>
          <H2>Limpeza automatizada</H2>
          <P>
            Uma rotina executada diariamente remove sessões expiradas 30 dias
            após sua expiração e códigos/tokens de verificação 1 dia após
            expirarem. Convites de workspace pendentes que ultrapassam o prazo
            configurado são marcados como expirados automaticamente.
          </P>
        </div>

        <div>
          <H2>Encerramento de conta</H2>
          <P>
            O Cliente pode solicitar a exclusão da sua conta a qualquer momento.
            A exclusão é agendada com um período de carência que permite
            reverter pedidos feitos por engano; ao final desse período, os dados
            pessoais e os Dados do Cliente do workspace são apagados dos
            sistemas de produção, ressalvada a retenção do mínimo necessário
            para cumprir obrigações legais, resolver disputas ou prevenir
            fraude. O Cliente é responsável por exportar seus dados antes do
            encerramento — depois desse prazo, a exclusão não pode ser
            revertida.
          </P>
        </div>

        <div>
          <H2>Exportação de dados</H2>
          <P>
            Usuários podem solicitar a exportação dos seus dados de conta
            diretamente nas configurações do produto. O arquivo gerado fica
            disponível para download por meio de um link temporário e assinado,
            com validade limitada, e o pedido é limitado em frequência para
            evitar abuso.
          </P>
        </div>

        <div>
          <H2>Obrigações legais de retenção</H2>
          <P>
            Registros de cobrança e demais dados cuja guarda seja exigida por
            lei são mantidos pelo prazo legal aplicável, tipicamente 5 anos no
            caso de obrigações fiscais no Brasil, ainda que a conta tenha sido
            encerrada.
          </P>
        </div>
      </section>
    </main>
  )
}
