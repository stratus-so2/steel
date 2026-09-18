import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from 'react-email'
import { baseEmailUrl } from '@/lib/base-email-url'
import type { CrmProposalExpiredEmailProps } from '@/types/mail'
import { EmailFooter } from '../_components/email-footer'

export const CrmProposalExpired = ({
  username,
  proposalName,
  workspaceName,
  validUntil,
  proposalUrl,
}: CrmProposalExpiredEmailProps) => (
  <Html>
    <Head />
    <Tailwind>
      <Body className='bg-[#f4f5f5] font-sans py-6'>
        <Preview>Steel | A proposta {proposalName} expirou.</Preview>
        <Container className='bg-white mx-auto py-10 px-6 max-w-140'>
          <Img
            width={120}
            height={33.8}
            className='mb-10'
            src={`${baseEmailUrl}/brand/logo-email.png`}
            alt='Steel'
          />
          <Section>
            <Text className='text-2xl leading-6.5'>
              <strong>A proposta {proposalName} expirou</strong>
            </Text>
            <Text className='text-[14px] leading-6.5 font-light'>
              {username ? `Olá, ${username}. ` : ''}A validade da proposta{' '}
              <strong className='font-semibold'>{proposalName}</strong>, do
              workspace <strong className='font-semibold'>{workspaceName}</strong>
              , terminou em {validUntil} sem resposta do cliente.
            </Text>
            <Text className='text-[14px] leading-6.5 font-light'>
              O link público continua no ar, mas o cliente não consegue mais
              aceitá-la. Se a negociação continua, peça a um administrador do
              CRM para estender a validade ou envie uma nova proposta.
            </Text>
          </Section>
          <Section className='my-5'>
            <Button
              className='rounded-sm py-3 px-2.5 bg-[#2893cc] text-white text-center font-semibold'
              style={{ width: '-webkit-fill-available' }}
              href={proposalUrl}
            >
              Abrir a proposta
            </Button>
          </Section>
          <Section>
            <Text className='text-[14px] leading-6.5 font-light'>
              Ou copie e cole essa URL no seu navegador:{' '}
              <Link href={proposalUrl}>{proposalUrl}</Link>
            </Text>
          </Section>
          <EmailFooter />
        </Container>
      </Body>
    </Tailwind>
  </Html>
)

export default CrmProposalExpired
