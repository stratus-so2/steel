import type { Metadata } from 'next'
import { H1 } from '@/components/typography/heading/h1'
import { H2 } from '@/components/typography/heading/h2'
import { Muted } from '@/components/typography/text/muted'
import { P } from '@/components/typography/text/p'
import { TERMS_VERSION } from '@/lib/legal/versions'

export const metadata: Metadata = {
  title: 'Termos de Serviço | Steel',
  description: 'Os termos que regem o uso do Steel.',
}

export default function ServiceTermPage() {
  return (
    <main className='mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16'>
      <header className='flex flex-col gap-2 text-left'>
        <H1 className='text-left'>Termos de Serviço</H1>
        <Muted>Versão {TERMS_VERSION}</Muted>
      </header>

      <P>
        Estes Termos de Serviço ("Termos") regulam o acesso e uso da plataforma{' '}
        <strong>Steel</strong> ("Plataforma"), incluindo os módulos de Service
        Desk, CRM e Comunicação, disponibilizada por{' '}
        <strong>Alexandre de Carvalho ME</strong>, nome fantasia{' '}
        <strong>Stratus Telecom</strong>, CNPJ nº 04.554.476/0001-25, com sede
        na Av. Senador Feijó, 686, Sala 1402, Vila Matias, Santos/SP, CEP
        11015-504 ("Stratus Telecom", "Contratada" ou "nós"). A pessoa física ou
        jurídica que contrata ou utiliza o Serviço é denominada "Cliente".
      </P>
      <P>
        Ao criar uma conta, aceitar estes Termos ou utilizar o Serviço, o
        Cliente concorda com este contrato. Quem o aceita em nome de pessoa
        jurídica declara possuir poderes suficientes para vinculá-la. A
        contratação somente é permitida a maiores de 18 anos e pessoas capazes.
      </P>

      <section className='flex flex-col gap-4'>
        <div>
          <H2>1. Serviço e licença</H2>
          <P>
            A Contratada disponibiliza, por assinatura, a Plataforma como
            software como serviço (SaaS). Recursos, limites, integrações, preços
            e módulos habilitados são os previstos no plano, proposta comercial
            ou interface aplicável.
          </P>
          <P>
            Sujeito a estes Termos e ao pagamento devido, a Contratada concede
            ao Cliente licença limitada, revogável, não exclusiva,
            intransferível e não sublicenciável para uso interno da Plataforma
            por seus usuários autorizados durante a vigência da contratação. O
            Serviço é fornecido como ferramenta de apoio; o Cliente permanece
            integralmente responsável por suas decisões, atendimentos,
            comunicações, cadastros, campanhas e resultados comerciais.
          </P>
          <P>
            A Contratada poderá corrigir erros, atualizar, alterar, limitar,
            substituir ou descontinuar recursos, inclusive por razões técnicas,
            de segurança, legais ou decorrentes de terceiros. Sempre que
            razoavelmente possível, buscará comunicar alterações materiais que
            afetem substancialmente o uso contratado.
          </P>
        </div>

        <div>
          <H2>2. Conta, usuários e segurança</H2>
          <P>
            O Cliente é responsável: (i) pela veracidade e atualização dos dados
            cadastrais; (ii) por definir e administrar os acessos de seus
            usuários; (iii) por guardar senhas, tokens, chaves de API e demais
            credenciais; e (iv) por toda atividade realizada em sua conta,
            inclusive por empregados, contratados e terceiros autorizados.
          </P>
          <P>
            O Cliente deverá comunicar imediatamente qualquer suspeita de acesso
            indevido. A Stratus poderá suspender, redefinir credenciais ou
            restringir acessos quando necessário para proteger a conta, a
            Plataforma, terceiros ou cumprir obrigação legal, sem que isso gere
            direito a indenização.
          </P>
        </div>

        <div>
          <H2>3. Dados do Cliente e privacidade</H2>
          <P>
            "Dados do Cliente" são dados, conteúdos, arquivos, contatos,
            registros, mensagens e demais informações inseridos, enviados,
            recebidos ou disponibilizados pelo Cliente no Serviço. Entre as
            partes, o Cliente conserva os direitos sobre esses dados.
          </P>
          <P>
            Quando a Stratus tratar dados pessoais inseridos pelo Cliente para
            prestar o Serviço, o Cliente será, em regra, o{' '}
            <strong>controlador</strong> e a Stratus atuará como{' '}
            <strong>operadora</strong>, tratando-os conforme as instruções
            documentadas do Cliente e a legislação aplicável. Isso não se aplica
            aos dados que a Stratus tratar como controladora para administrar
            sua própria relação com o Cliente, tais como dados de cadastro,
            cobrança, segurança, suporte e uso do Serviço, conforme a{' '}
            <a href='/legals/privacy' className='underline'>
              Política de Privacidade
            </a>
            .
          </P>
          <P>
            O Cliente declara e garante que possui base legal, avisos,
            autorizações e direitos necessários para coletar, usar, inserir,
            compartilhar e tratar os Dados do Cliente no Serviço; que atenderá
            solicitações dos titulares; e que observará a LGPD, normas de defesa
            do consumidor, regras de marketing e demais leis aplicáveis. A
            Stratus não revisa nem valida previamente a licitude dos Dados do
            Cliente ou das instruções do Cliente.
          </P>
          <P>
            O Cliente não deverá inserir dados pessoais sensíveis, dados de
            crianças e adolescentes ou dados sujeitos a regime especial, salvo
            se tiver base legal, medidas adequadas e autorização prévia e
            expressa da Stratus quando necessária. O Cliente também deverá
            manter cópia própria dos Dados do Cliente e realizar exportações
            antes do encerramento da conta.
          </P>
          <P>
            O Cliente concede à Stratus a autorização necessária para hospedar,
            copiar, transmitir, exibir e processar os Dados do Cliente
            exclusivamente para prestar, proteger, manter e dar suporte ao
            Serviço, cumprir obrigações legais, prevenir fraude ou incidente de
            segurança e executar instruções documentadas do Cliente. A Stratus
            poderá usar dados de uso, telemetria e métricas agregadas ou
            anonimizadas para operar, proteger e aprimorar o Serviço, desde que
            não identifiquem o Cliente ou titulares.
          </P>
          <P>
            O tratamento de dados pessoais é complementado pela Política de
            Privacidade e pela{' '}
            <a href='/legals/subprocessors' className='underline'>
              Lista de Subprocessadores
            </a>{' '}
            vigentes, que integram estes Termos. O Cliente autoriza o uso dos
            subprocessadores ali listados e daqueles necessários para recursos
            opcionais que solicitar ou habilitar, observadas as condições
            divulgadas. Detalhes adicionais sobre nossas práticas técnicas e
            organizacionais de segurança estão disponíveis na página de{' '}
            <a href='/legals/security' className='underline'>
              Segurança
            </a>
            , incluindo controles inspirados nos critérios do SOC 2 (Trust
            Services Criteria) como referência de boas práticas — o que não
            representa certificação SOC 2 (Type I ou Type II) vigente, emitida
            por auditor independente.
          </P>
        </div>

        <div>
          <H2>4. Comunicação, WhatsApp e integrações</H2>
          <P>
            O Serviço pode permitir a conexão com serviços de terceiros,
            inclusive Meta/WhatsApp Business Platform, Z-API, redes sociais,
            plataformas de anúncios, e-mail, IA e pagamentos ("Provedores
            Integrados"). Esses serviços possuem termos, políticas, limites,
            cobranças, disponibilidade e decisões próprios, que o Cliente deverá
            aceitar e cumprir.
          </P>
          <P>
            O Cliente declara que é titular ou possui autorização válida para
            conectar cada conta, número, canal ou integração; que possui base
            legal e, quando exigido, consentimento/opt-in dos destinatários; e
            que respeitará solicitações de descadastramento, bloqueio e
            oposição. O Cliente é o único responsável pelo conteúdo, frequência,
            segmentação, destinatários, templates, campanhas e mensagens
            enviadas por seus usuários ou automações.
          </P>
          <P>
            É proibido usar o Serviço para spam, phishing, fraude, assédio,
            conteúdo ilícito, coleta irregular de dados, violação de direitos de
            terceiros ou infração às regras de qualquer Provedor Integrado. A
            utilização de integrações não oficiais, incluindo eventual conexão
            via WhatsApp Web/Z-API, ocorre por conta e risco do Cliente.
            Bloqueios de números, contas, templates ou canais, bem como mudanças
            de API, política, preço ou disponibilidade de terceiros, não
            constituem falha do Steel nem geram reembolso, indenização ou
            crédito.
          </P>
          <P>
            O Steel não controla os Provedores Integrados e não garante a
            continuidade, o resultado ou a disponibilidade de suas integrações.
            O Cliente deverá manter relação, permissões, pagamentos e
            credenciais exigidos pelo respectivo provedor.
          </P>
        </div>

        <div>
          <H2>5. Recursos de IA</H2>
          <P>
            Recursos de inteligência artificial são auxiliares e podem gerar
            respostas imprecisas, incompletas, inadequadas ou indisponíveis. O
            Cliente deve revisar toda saída antes de usá-la, especialmente antes
            de enviar comunicações, tomar decisões ou utilizá-la em contextos
            que produzam efeito relevante sobre pessoas.
          </P>
          <P>
            O Cliente é responsável pela licitude dos dados, comandos e
            conteúdos submetidos aos Recursos de IA e por validar se seu uso é
            apropriado. O Steel não garante exatidão, originalidade, adequação,
            disponibilidade ou resultado de saídas de IA. Provedores de IA
            poderão processar dados estritamente para viabilizar o recurso
            solicitado, conforme a documentação e políticas aplicáveis.
          </P>
        </div>

        <div>
          <H2>6. Uso aceitável</H2>
          <P>
            O Cliente não poderá, nem permitirá que terceiros: (a) usar o
            Serviço de modo ilegal ou em violação destes Termos; (b) acessar
            workspaces ou dados de terceiros sem autorização; (c) interferir no
            Serviço, contornar limites técnicos ou testar sua vulnerabilidade
            sem autorização; (d) copiar, modificar, fazer engenharia reversa,
            descompilar ou tentar extrair código-fonte, salvo na medida em que a
            lei expressamente não permita restrição; (e) revender, locar,
            sublicenciar ou disponibilizar o Serviço a terceiros, exceto a
            usuários autorizados; (f) transmitir malware, código malicioso ou
            conteúdo que viole direitos; ou (g) usar o Serviço para desenvolver
            produto concorrente ou realizar análise competitiva.
          </P>
          <P>
            O Steel poderá investigar violações, remover ou restringir conteúdo
            quando necessário, suspender acessos e cooperar com autoridades
            competentes, sem assumir obrigação de monitoramento geral do uso
            pelo Cliente.
          </P>
        </div>

        <div>
          <H2>7. Preços, cobrança e cancelamento</H2>
          <P>
            Os valores, periodicidade, impostos e limites aplicáveis são os
            informados no plano, proposta ou checkout. Salvo indicação expressa
            em contrário, valores são cobrados antecipadamente, não são
            reembolsáveis e não incluem tributos eventualmente incidentes. O
            Cliente é responsável pelos tributos, encargos e custos relacionados
            ao seu uso, exceto tributos incidentes sobre a renda do Steel.
          </P>
          <P>
            Assinaturas poderão ser renovadas automaticamente por períodos
            sucessivos iguais ao contratado, salvo cancelamento antes da
            renovação pelos meios disponibilizados. O cancelamento impede
            cobranças futuras, mas não gera devolução de valores relativos ao
            período já contratado ou disponibilizado, ressalvadas as hipóteses
            obrigatórias previstas em lei.
          </P>
          <P>
            O atraso ou não pagamento autoriza o Steel, após aviso razoável, a
            suspender o Serviço, limitar recursos, impedir novas integrações
            e/ou encerrar a conta, sem prejuízo da cobrança de valores devidos,
            encargos legalmente permitidos e despesas de cobrança. Reajustes e
            alterações de preço poderão ser comunicados antes da próxima
            renovação.
          </P>
        </div>

        <div>
          <H2>8. Propriedade intelectual e feedback</H2>
          <P>
            O Serviço, marca Steel, documentação, interface, código, tecnologia,
            melhorias e demais direitos de propriedade intelectual pertencem ao
            Steel ou a seus licenciadores. Nenhum direito é transferido ao
            Cliente além da licença expressa nestes Termos.
          </P>
          <P>
            O Cliente poderá enviar sugestões ou feedback. O Steel poderá
            usá-los livremente, sem obrigação de pagamento, atribuição ou
            confidencialidade, desde que não divulgue Dados do Cliente em
            desacordo com estes Termos.
          </P>
        </div>

        <div>
          <H2>9. Confidencialidade</H2>
          <P>
            Cada parte protegerá as informações confidenciais da outra com
            cuidado razoável e somente as usará para executar estes Termos.
            Dados do Cliente são informações confidenciais do Cliente; o
            Serviço, a documentação não pública, os preços não públicos, a
            tecnologia e informações de segurança são informações confidenciais
            do Steel.
          </P>
          <P>
            Não são confidenciais informações que sejam públicas sem violação
            destes Termos, já fossem conhecidas legitimamente, tenham sido
            recebidas de terceiro sem dever de sigilo ou tenham sido
            desenvolvidas de forma independente. A divulgação exigida por lei ou
            autoridade competente será permitida, quando possível com aviso
            prévio à outra parte.
          </P>
        </div>

        <div>
          <H2>10. Suspensão, vigência e dados após o término</H2>
          <P>
            Estes Termos vigoram enquanto a conta ou assinatura permanecer
            ativa. O Steel poderá, a seu critério razoável e sem
            responsabilidade, suspender ou encerrar o acesso em caso de
            inadimplência, risco de segurança, uso proibido, violação destes
            Termos, exigência legal, ordem de autoridade ou risco a terceiros, à
            plataforma ou aos Provedores Integrados.
          </P>
          <P>
            Após encerramento ou expiração, a licença de uso termina. O Cliente
            poderá solicitar exportação dos Dados do Cliente durante o prazo
            indicado na Política de Privacidade ou na interface, sujeito à
            adimplência. Depois desse prazo, o Steel poderá excluir os Dados do
            Cliente, salvo retenção necessária para cumprir obrigação legal,
            resolver disputa, prevenir fraude ou manter cópias de segurança pelo
            ciclo técnico normal. O Cliente é responsável por exportar seus
            dados em tempo hábil.
          </P>
        </div>

        <div>
          <H2>11. Garantias e limitação de responsabilidade</H2>
          <P>
            Na máxima extensão permitida pela legislação aplicável, o Serviço é
            fornecido "como está" e "conforme disponível". O Steel não garante
            que o Serviço será ininterrupto, livre de erros, compatível com
            qualquer sistema, adequado a finalidade específica ou que produzirá
            resultados comerciais, operacionais ou regulatórios desejados.
          </P>
          <P>
            O Steel não responde por: (i) Dados do Cliente e atos ou omissões do
            Cliente, seus usuários, destinatários ou Provedores Integrados; (ii)
            bloqueios, penalidades, indisponibilidades, alterações ou decisões
            de terceiros; (iii) perda decorrente de credenciais comprometidas
            sob responsabilidade do Cliente; (iv) falhas de internet,
            equipamentos, sistemas ou serviços fora do controle razoável do
            Steel; ou (v) decisões tomadas com base em recursos de IA.
          </P>
          <P>
            Na máxima extensão permitida por lei, o Steel não será responsável
            por lucros cessantes, perda de receita, perda de oportunidade, perda
            de dados, dano indireto, incidental, especial, punitivo ou
            consequencial. A responsabilidade total agregada do Steel por
            qualquer reclamação relacionada ao Serviço ficará limitada ao total
            efetivamente pago pelo Cliente ao Steel nos 3 (três) meses
            anteriores ao fato que gerou a reclamação. Esta cláusula não limita
            responsabilidade que não possa ser excluída ou limitada por lei.
          </P>
          <P>
            Nada nestes Termos afasta direitos inderrogáveis aplicáveis a
            consumidores. Nas relações sujeitas ao Código de Defesa do
            Consumidor, as disposições serão interpretadas e aplicadas conforme
            a legislação obrigatória.
          </P>
        </div>

        <div>
          <H2>12. Alterações, comunicações e disposições gerais</H2>
          <P>
            O Steel poderá atualizar estes Termos. Alterações materiais serão
            comunicadas por e-mail, interface ou outro meio razoável antes de
            vigorarem, quando aplicável. A continuidade de uso após a data de
            vigência representa aceite; se o Cliente não concordar, deverá
            encerrar a assinatura antes da próxima renovação.
          </P>
          <P>
            Nenhuma parte poderá ceder estes Termos sem consentimento da outra,
            exceto o Steel em reorganização societária, fusão, aquisição ou
            transferência de ativos relacionados ao Serviço. O Steel poderá
            utilizar afiliadas e fornecedores para executar o Serviço.
          </P>
          <P>
            Nenhuma parte será responsável por atraso ou falha causada por
            evento fora de seu controle razoável, inclusive falhas de
            provedores, ataques cibernéticos generalizados, desastres naturais,
            atos governamentais e interrupções de telecomunicações. Estes
            Termos, a Política de Privacidade, a Lista de Subprocessadores e a
            proposta/plano aplicável constituem o acordo integral entre as
            partes. Se uma cláusula for inválida, as demais continuam válidas.
          </P>
          <P>
            Estes Termos são regidos pelas leis brasileiras. Para disputas
            empresariais, fica eleito o foro da Comarca de Santos/SP, com
            renúncia a outro, quando juridicamente permitido. Para consumidores,
            será observado o foro e a competência definidos pela legislação
            aplicável.
          </P>
        </div>

        <div>
          <H2>13. Contato</H2>
          <P>
            Dúvidas e comunicações ao Steel:{' '}
            <strong>juridico@stratustelecom.com.br</strong>,{' '}
            <strong>+55 11 5196-1069</strong> ou{' '}
            <strong>+55 13 3467-3304</strong>.
          </P>
        </div>
      </section>
    </main>
  )
}
