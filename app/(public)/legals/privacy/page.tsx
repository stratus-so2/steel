import type { Metadata } from 'next'
import { H1 } from '@/components/typography/heading/h1'
import { H2 } from '@/components/typography/heading/h2'
import { Muted } from '@/components/typography/text/muted'
import { P } from '@/components/typography/text/p'
import { PRIVACY_VERSION } from '@/lib/legal/versions'

export const metadata: Metadata = {
  title: 'Política de Privacidade | Steel',
  description: 'Como o Steel coleta, usa e protege seus dados.',
}

export default function PrivacyPolicyPage() {
  return (
    <main className='mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16'>
      <header className='flex flex-col gap-2 text-left'>
        <H1 className='text-left'>Política de Privacidade</H1>
        <Muted>Versão {PRIVACY_VERSION}</Muted>
      </header>

      <div className='rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 p-4'>
        <P className='mt-0 text-sm'>
          Este documento está em rascunho e pendente de revisão jurídica —
          nenhuma versão gerada automaticamente deve ser publicada como final
          sem validação de um advogado, especialmente quanto às obrigações de
          transferência internacional (GDPR).
        </P>
      </div>

      <P>
        Esta Política de Privacidade explica como{' '}
        <strong>Alexandre de Carvalho ME</strong> (nome fantasia{' '}
        <strong>Stratus Telecom</strong>), inscrita no CNPJ sob o nº{' '}
        <strong>04.554.476/0001-25</strong>, com sede na Av. Senador Feijó, 686,
        Sala 1402, Vila Matias, Santos - SP, CEP 11015-504 ("Steel", "nós"),
        coleta, usa, compartilha e protege dados pessoais no contexto da
        plataforma Steel (módulos de Service Desk, CRM e Comunicação), em
        conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018,
        "LGPD") e, para titulares localizados no Espaço Econômico Europeu, Reino
        Unido ou Suíça, com o Regulamento Geral de Proteção de Dados
        (Regulamento (UE) 2016/679, "GDPR"). Termos em maiúscula não definidos
        aqui têm o significado atribuído nos nossos Termos de Serviço.
      </P>

      <section className='flex flex-col gap-4'>
        <div id='papel'>
          <H2>1. Nosso papel: controlador vs. operador</H2>
          <P>
            O Steel atua como <strong>controlador</strong> dos dados de conta
            (nome, e-mail, dados de cobrança) dos usuários que criam um
            workspace, e como <strong>operador</strong> (ou "processor", nos
            termos do GDPR) dos Dados do Cliente inseridos dentro de um
            workspace — contatos, conversas de WhatsApp, registros de CRM,
            tickets. Nesse segundo caso, quem determina a finalidade do
            tratamento é o próprio Cliente, titular do workspace.
          </P>
          <P>
            Se você é um contato, lead ou destinatário de mensagem cujos dados
            foram inseridos por um Cliente do Steel (por exemplo, alguém que
            conversou pelo WhatsApp de uma empresa que usa o Steel), procure
            diretamente essa empresa para exercer seus direitos — o Steel
            processa esses dados apenas sob instrução dela, como operador.
          </P>
        </div>

        <div id='escopo'>
          <H2>2. Escopo desta política</H2>
          <P>
            Esta política cobre o site do Steel, o produto (todos os módulos:
            Service Desk, CRM e Comunicação) e nossos canais de suporte e
            vendas. Ela não substitui o Acordo de Tratamento de Dados (DPA)
            eventualmente firmado com Clientes para o tratamento de Dados do
            Cliente como operador — em caso de conflito quanto a esse tratamento
            específico, o DPA prevalece.
          </P>
        </div>

        <div id='dados-coletados'>
          <H2>3. Dados que coletamos</H2>
          <P>
            <strong>Dados de conta.</strong> Nome, e-mail, senha (armazenada com
            hash, nunca em texto plano), foto de perfil e preferências de conta
            ao criar seu cadastro, inclusive via login social com{' '}
            <strong>Google</strong> ou <strong>GitHub</strong>.
          </P>
          <P>
            <strong>Dados de cobrança.</strong> Nome e endereço de cobrança e os
            últimos dígitos do cartão. Os dados completos do cartão são
            processados diretamente pelo nosso processador de pagamentos (
            <strong>AbacatePay</strong>) e nunca chegam a ser armazenados pelo
            Steel.
          </P>
          <P>
            <strong>Dados do Cliente — Comunicação (WhatsApp).</strong>{' '}
            Conversas, contatos, mensagens (texto, áudio, imagem, documento) e
            metadados de entrega recebidos ou enviados através de números
            conectados via <strong>Meta</strong> (WhatsApp Business Platform,
            API oficial) ou <strong>Z-API</strong> (integração não oficial).
          </P>
          <P>
            <strong>Dados do Cliente — CRM e redes sociais.</strong> Registros
            de empresas, pessoas, oportunidades e leads; e, quando você conecta
            contas externas via OAuth, os dados e métricas disponibilizados por{' '}
            <strong>Meta (Facebook e Instagram)</strong>,{' '}
            <strong>TikTok</strong>, <strong>YouTube</strong>,{' '}
            <strong>LinkedIn</strong>, <strong>X (Twitter)</strong> e{' '}
            <strong>Google (Google Ads e Google Analytics)</strong>, conforme o
            escopo de permissões que você autorizou em cada conexão.
          </P>
          <P>
            <strong>Dados do Cliente — Service Desk.</strong> Tickets,
            comentários e anexos registrados no módulo de atendimento.
          </P>
          <P>
            <strong>Dados de uso e técnicos.</strong> Endereço IP, tipo de
            navegador e dispositivo, páginas e funcionalidades acessadas,
            registros de auditoria de ações realizadas na plataforma, e logs de
            erro e desempenho, coletados através da nossa plataforma de
            observabilidade (<strong>Axiom</strong>) para fins de suporte e
            segurança.
          </P>
          <P>
            <strong>Dados de suporte.</strong> Informações que você nos envia ao
            entrar em contato com nosso suporte ou responder pesquisas.
          </P>
        </div>

        <div id='finalidades'>
          <H2>4. Como usamos suas informações</H2>
          <P>
            Usamos os dados coletados para: (a) prestar, manter e dar suporte à
            plataforma; (b) autenticar usuários e proteger contas contra acesso
            não autorizado; (c) processar cobranças e gerir assinaturas; (d)
            enviar comunicações transacionais (confirmação de conta, alertas de
            segurança, recibos), via <strong>Resend</strong>, e, mediante
            opt-in, comunicações de marketing; (e) analisar métricas de uso
            agregadas para melhorar o produto; (f) viabilizar recursos de
            inteligência artificial descritos na Seção 9; (g) detectar, prevenir
            e investigar fraude, abuso e incidentes de segurança; e (h) cumprir
            obrigações legais e responder a solicitações de titulares.
          </P>
        </div>

        <div id='bases-legais'>
          <H2>5. Bases legais para o tratamento</H2>
          <P>
            <strong>Sob a LGPD (art. 7º),</strong> tratamos dados com base em:
            execução de contrato (criar e manter sua conta, processar
            pagamentos, prestar o serviço); legítimo interesse (melhorar a
            plataforma, prevenir fraude, segurança da infraestrutura, sem
            sobrepor seus direitos fundamentais); consentimento (comunicações de
            marketing opcionais e recursos de IA sobre Dados do Cliente, quando
            exigido); e cumprimento de obrigação legal ou regulatória.
          </P>
          <P>
            <strong>
              Sob o GDPR (art. 6º), para titulares no EEE/Reino Unido/Suíça,
            </strong>{' '}
            as mesmas hipóteses se aplicam sob os rótulos equivalentes: execução
            de contrato, interesses legítimos, consentimento e obrigação legal.
            Quando nos baseamos em interesses legítimos, realizamos um teste de
            balanceamento para assegurar que nossos interesses não se sobrepõem
            aos seus direitos e liberdades fundamentais.
          </P>
        </div>

        <div id='compartilhamento'>
          <H2>6. Como compartilhamos suas informações</H2>
          <P>
            Não vendemos dados pessoais e não compartilhamos dados pessoais para
            fins de publicidade comportamental entre contextos ("cross-context
            behavioral advertising"). Só compartilhamos dados com as seguintes
            categorias de terceiros, na medida necessária para operar o Steel:
          </P>
          <P>
            <strong>Provedores de mensageria (Comunicação):</strong>{' '}
            <strong>Meta Platforms, Inc.</strong> (WhatsApp Business Platform) e{' '}
            <strong>Z-API</strong>, para entrega e recebimento de mensagens de
            WhatsApp.
          </P>
          <P>
            <strong>Redes sociais e marketing conectados pelo Cliente:</strong>{' '}
            Meta (Facebook, Instagram), TikTok, YouTube (Google), LinkedIn, X
            (Twitter), Google Ads e Google Analytics — apenas quando e na medida
            em que o Cliente autoriza uma conexão específica.
          </P>
          <P>
            <strong>Autenticação:</strong> Google e GitHub, quando você opta por
            entrar com essas contas.
          </P>
          <P>
            <strong>Infraestrutura e operação:</strong> hospedagem e banco de
            dados, armazenamento de arquivos compatível com S3/MinIO,{' '}
            <strong>AbacatePay</strong> (pagamentos), <strong>Resend</strong>{' '}
            (e-mail transacional) e <strong>Axiom</strong>{' '}
            (observabilidade/logs). Todos vinculados contratualmente a usar
            dados apenas conforme nossas instruções.
          </P>
          <P>
            <strong>Provedores de IA:</strong> <strong>OpenAI</strong> (ou outro
            provedor que venha a substituí-lo), conforme descrito na Seção 9.
          </P>
          <P>
            <strong>Obrigação legal:</strong> quando exigido por lei, ordem
            judicial ou solicitação de autoridade competente.
          </P>
          <P>
            <strong>Transação societária:</strong> em caso de fusão, aquisição
            ou venda de ativos, mediante aviso prévio.
          </P>
          <P>
            A lista atualizada de subprocessadores (nome, finalidade e
            localização) está disponível na nossa{' '}
            <a href='/legals/subprocessors' className='underline'>
              página de Subprocessadores
            </a>
            .
          </P>
        </div>

        <div id='transferencia-internacional'>
          <H2>7. Transferência internacional de dados</H2>
          <P>
            <strong>Alexandre de Carvalho ME</strong> está sediada no Brasil.
            Alguns dos terceiros listados na Seção 6 (incluindo Meta, Google,
            TikTok, LinkedIn, X, OpenAI e provedores de infraestrutura)
            processam dados fora do Brasil, inclusive nos Estados Unidos. Essas
            transferências são feitas com base nas hipóteses do art. 33 da LGPD
            e, quando aplicável a titulares do EEE/Reino Unido/Suíça, mediante
            salvaguardas apropriadas reconhecidas pelo GDPR, como Cláusulas
            Contratuais Padrão (SCCs) aprovadas pela Comissão Europeia e, quando
            cabível, o UK International Data Transfer Agreement (IDTA).
          </P>
        </div>

        <div id='cookies'>
          <H2>8. Cookies e tecnologias semelhantes</H2>
          <P>
            Usamos cookies essenciais para autenticação e segurança de sessão
            (não podem ser desabilitados sem impedir o funcionamento do produto)
            e cookies funcionais para lembrar preferências de interface, como
            tema e fuso horário. Não usamos cookies de publicidade ou de
            rastreamento de terceiros para fins de anúncios. Você pode gerenciar
            cookies não essenciais nas configurações do seu navegador. Não
            respondemos atualmente a sinais de "Do Not Track", mas honramos
            sinais de Global Privacy Control (GPC) como manifestação válida de
            oposição, onde exigido por lei.
          </P>
        </div>

        <div id='ia'>
          <H2>9. Recursos de Inteligência Artificial</H2>
          <P>
            O Steel oferece recursos de IA (assistente de IA do CRM, resposta
            automática e análise de sentimento de mensagens de WhatsApp). Quando
            você usa esses recursos, os dados de entrada (por exemplo, o
            histórico da conversa ou o texto submetido) são enviados a
            provedores terceirizados de IA (<strong>OpenAI</strong>) para gerar
            a resposta solicitada. Esse processamento é feito sob instrução do
            Cliente titular do workspace, que pode habilitar ou desabilitar
            esses recursos.
          </P>
          <P>
            O Steel não utiliza Dados do Cliente para treinar, ajustar ou
            melhorar modelos de IA de uso geral — próprios ou de terceiros.
            Saídas geradas por IA são tratadas como Dados do Cliente e recebem
            as mesmas proteções desta política. Você é responsável por revisar e
            validar qualquer saída de IA antes de utilizá-la.
          </P>
        </div>

        <div id='retencao'>
          <H2>10. Retenção e descarte</H2>
          <P>
            Mantemos dados pessoais apenas pelo tempo necessário às finalidades
            descritas nesta política ou exigido por lei. Sessões expiradas são
            removidas automaticamente após 30 dias; códigos de verificação, após
            1 dia. Dados de cobrança são retidos pelo prazo exigido pela
            legislação fiscal aplicável (tipicamente 5 anos no Brasil).
          </P>
          <P>
            Quando você solicita a exclusão da sua conta, ela é agendada para um
            período de carência que permite reverter exclusões acidentais; ao
            final desse período, seus dados pessoais e os Dados do Cliente do
            workspace são apagados dos nossos sistemas de produção, ressalvada a
            retenção do mínimo necessário para cumprir obrigações legais ou
            defender direitos em processos.
          </P>
        </div>

        <div id='seguranca'>
          <H2>11. Segurança da informação</H2>
          <P>
            Adotamos medidas técnicas e organizacionais para proteger dados
            pessoais, incluindo criptografia em trânsito (TLS) e em repouso,
            senhas armazenadas apenas com hash, autenticação de dois fatores
            opcional, controle de acesso por papel dentro de cada workspace,
            isolamento lógico entre workspaces, e monitoramento e registro de
            eventos de segurança via Axiom.
          </P>
          <P>
            Nossos controles de segurança são estruturados em torno dos
            critérios de confiança do SOC 2 (Trust Services Criteria) —
            segurança, disponibilidade e confidencialidade. Essa é uma
            referência de boas práticas: o Steel não possui, até o momento,
            certificação SOC 2 (Type I ou Type II) emitida por auditor
            independente. Detalhes adicionais estão na nossa página de
            Segurança.
          </P>
          <P>
            Nenhum sistema é totalmente livre de riscos — você também é
            responsável por proteger suas credenciais de acesso. Em caso de
            incidente de segurança que possa acarretar risco ou dano relevante
            aos titulares, notificaremos os afetados e a Autoridade Nacional de
            Proteção de Dados (ANPD) conforme exigido pela LGPD e, quando
            aplicável, as autoridades supervisoras competentes sob o GDPR,
            dentro dos prazos legais.
          </P>
        </div>

        <div id='direitos'>
          <H2>12. Seus direitos</H2>
          <P>
            Sob a LGPD (art. 18) e, quando aplicável, o GDPR, você pode a
            qualquer momento: confirmar a existência de tratamento; acessar seus
            dados; corrigir dados incompletos, inexatos ou desatualizados;
            solicitar anonimização, bloqueio, eliminação ou portabilidade de
            dados; revogar consentimento previamente dado; opor-se a tratamentos
            baseados em legítimo interesse; e obter informação sobre com quem
            compartilhamos seus dados.
          </P>
          <P>
            A exportação dos seus dados de conta pode ser solicitada diretamente
            pela plataforma, nas configurações da conta — geramos um arquivo com
            seus dados e disponibilizamos um link de download temporário. Para
            as demais solicitações, entre em contato pelo canal indicado na
            Seção 15. Responderemos dentro do prazo previsto na legislação
            aplicável.
          </P>
          <P>
            Se você está no EEE, Reino Unido ou Suíça, também tem o direito de
            apresentar reclamação à autoridade de proteção de dados do seu país
            (lista das autoridades da UE em edpb.europa.eu; no Reino Unido, o
            ICO; na Suíça, o FDPIC), sem prejuízo de outros recursos
            administrativos ou judiciais.
          </P>
        </div>

        <div id='criancas'>
          <H2>13. Crianças e adolescentes</H2>
          <P>
            O Steel não é direcionado a menores de 18 anos e não coleta
            intencionalmente dados pessoais de crianças. Se tomarmos
            conhecimento de que coletamos dados de um menor sem o devido
            consentimento dos responsáveis, excluiremos essas informações
            prontamente.
          </P>
        </div>

        <div id='terceiros'>
          <H2>14. Serviços de terceiros</H2>
          <P>
            O Steel pode conter links ou integrações com sites e serviços de
            terceiros não operados por nós. Esta política não se aplica a esses
            serviços. Ao conectar uma integração de terceiro ao Steel
            (WhatsApp/Meta, Z-API, Google, TikTok, LinkedIn, X, YouTube), os
            dados compartilhados com esse terceiro passam a ser regidos também
            pela política de privacidade dele. O Steel não é responsável pelas
            práticas de privacidade de serviços de terceiros.
          </P>
        </div>

        <div id='contato'>
          <H2>15. Encarregado e contato</H2>
          <P>
            Nosso Encarregado pelo Tratamento de Dados Pessoais (DPO) pode ser
            contatado em <strong>alexandre@stratustelecom.com.br</strong>. Para
            dúvidas gerais sobre esta política, exercer seus direitos como
            titular, ou para assuntos jurídicos, escreva para{' '}
            <strong>juridico@stratustelecom.com.br</strong> — ou ligue para{' '}
            <strong>+55 11 5196-1069</strong> /{' '}
            <strong>+55 13 3467-3304</strong>. Se necessário sob o art. 27 do
            GDPR, os dados do nosso representante no EEE/Reino Unido serão
            informados mediante solicitação.
          </P>
        </div>

        <div id='alteracoes'>
          <H2>16. Alterações desta política</H2>
          <P>
            Podemos atualizar esta Política de Privacidade periodicamente.
            Mudanças materiais serão comunicadas por e-mail e/ou aviso no
            produto, com a versão vigente sempre identificada pela data no topo
            desta página. O uso continuado do Steel após a alteração entrar em
            vigor constitui aceite da versão atualizada.
          </P>
        </div>
      </section>
    </main>
  )
}
