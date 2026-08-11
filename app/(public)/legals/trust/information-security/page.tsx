import type { Metadata } from 'next'
import { H1 } from '@/components/typography/heading/h1'
import { H2 } from '@/components/typography/heading/h2'
import { Muted } from '@/components/typography/text/muted'
import { P } from '@/components/typography/text/p'

export const metadata: Metadata = {
  title: 'Segurança da Informação | Steel',
  description: 'Políticas de segurança da informação do Steel.',
}

export default function InformationSecurityPage() {
  return (
    <main className='mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16'>
      <header className='flex flex-col gap-2 text-left'>
        <H1 className='text-left'>Segurança da Informação</H1>
        <Muted>Atualizado em 11 de agosto de 2026</Muted>
      </header>

      <P>
        Esta página detalha os controles técnicos e organizacionais que protegem
        a plataforma Steel e complementa a{' '}
        <a href='/legals/privacy#seguranca' className='underline'>
          Seção de Segurança da Política de Privacidade
        </a>
        .
      </P>

      <section className='flex flex-col gap-4'>
        <div>
          <H2>Segurança no ciclo de desenvolvimento</H2>
          <P>
            Toda alteração de código passa por verificação automatizada de lint
            e tipagem estática antes de chegar ao branch principal. A cada push,
            um pipeline de integração contínua executa checagem de dependências
            vulneráveis (auditoria de pacotes bloqueando severidade crítica),
            análise estática de código voltada a aplicações
            Next.js/React/TypeScript, e varredura de segredos expostos no
            repositório. O deploy em produção só é disparado após essa pipeline
            concluir com sucesso.
          </P>
        </div>

        <div>
          <H2>Proteção de dados em trânsito</H2>
          <P>
            Todo tráfego é servido sobre HTTPS/TLS, com HSTS configurado com
            pré-carregamento para forçar conexões seguras em todas as
            subdomínios. Cada requisição recebe uma Content Security Policy com
            nonce único, restringindo a execução de scripts a fontes confiáveis
            e mitigando ataques de injeção de conteúdo (XSS).
          </P>
        </div>

        <div>
          <H2>Autenticação e credenciais</H2>
          <P>
            Senhas nunca são armazenadas em texto plano — usamos um algoritmo de
            hash com custo computacional ajustável (Argon2), reconhecido como
            referência para armazenamento seguro de senhas. Suportamos login
            social (Google, GitHub), verificação por código enviado por e-mail e
            autenticação de dois fatores opcional. Detalhes adicionais estão na
            página de{' '}
            <a href='/legals/trust/access-control' className='underline'>
              Controle de Acesso
            </a>
            .
          </P>
        </div>

        <div>
          <H2>Limitação de taxa e proteção contra abuso</H2>
          <P>
            Endpoints sensíveis — autenticação, códigos de verificação, envio de
            e-mail, exportação de dados, upload de arquivos e API pública —
            possuem limitação de taxa dedicada, com bloqueio temporário após
            tentativas repetidas de autenticação malsucedida.
          </P>
        </div>

        <div>
          <H2>Monitoramento e auditoria</H2>
          <P>
            Eventos relevantes de autenticação e mutações de dados sensíveis são
            registrados em uma trilha de auditoria estruturada, independente dos
            logs técnicos gerais. A disponibilidade dos principais componentes
            da plataforma (aplicação, banco de dados, cache, autenticação,
            pagamento, e-mail e armazenamento) é monitorada por sondas
            automatizadas, com status público em{' '}
            <a href='/status' className='underline'>
              /status
            </a>
            .
          </P>
        </div>

        <div>
          <H2>Frameworks de referência</H2>
          <P>
            Estruturamos nossos controles a partir dos critérios de confiança do
            SOC 2 (Trust Services Criteria), da ISO 27001 e dos princípios de
            segurança e minimização da LGPD/GDPR, como referência de boas
            práticas. Essa referência não constitui certificação: o Steel não
            possui, até o momento, certificação SOC 2 (Type I ou Type II), ISO
            27001 ou equivalente emitida por auditor independente, e nenhum
            conteúdo desta página deve ser interpretado como garantia de
            conformidade com qualquer framework de certificação.
          </P>
        </div>

        <div>
          <H2>Divulgação responsável de vulnerabilidades</H2>
          <P>
            Relatos de vulnerabilidades podem ser enviados para{' '}
            <strong>juridico@stratustelecom.com.br</strong>. Pedimos que o teste
            se limite ao necessário para demonstrar a falha, sem acessar,
            modificar ou extrair dados de outros workspaces.
          </P>
        </div>
      </section>
    </main>
  )
}
