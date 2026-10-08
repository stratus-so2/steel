import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Tailwind,
  Text,
} from 'react-email'
import { baseEmailUrl } from '@/lib/base-email-url'
import { EmailFooter } from '../_components/email-footer'

export interface WorkspaceExportReadyEmailProps {
  email: string
  username: string
  workspaceName: string
  /** `dados completos` | `logs`. */
  kindLabel: string
  /** Ajustes › Exportações of the workspace (the download needs a session). */
  pageUrl: string
  expiresAt: string
  fileSize: string
}

/** Ajustes › Exportações: the requested export is ready to download. */
export const WorkspaceExportReady = ({
  username,
  workspaceName,
  kindLabel,
  pageUrl,
  expiresAt,
  fileSize,
}: WorkspaceExportReadyEmailProps) => (
  <Html>
    <Head />
    <Tailwind>
      <Body className='bg-[#f4f5f5] font-sans py-6'>
        <Preview>Steel | A exportação de {workspaceName} está pronta</Preview>
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
              <strong>Sua exportação está pronta, {username}.</strong>
            </Text>
            <Text className='text-[14px] leading-6.5 font-light'>
              A exportação de{' '}
              <strong className='font-semibold'>{kindLabel}</strong> do
              workspace{' '}
              <strong className='font-semibold'>{workspaceName}</strong>{' '}
              terminou ({fileSize}).
            </Text>
            <Text className='text-[14px] leading-6.5 font-light'>
              Baixe o arquivo em Ajustes › Exportações até{' '}
              <strong className='font-semibold'>{expiresAt}</strong>. O
              download exige login: só o dono e os administradores do workspace
              têm acesso.
            </Text>
          </Section>
          <Section className='my-5'>
            <Button
              className='rounded-sm py-3 px-2.5 bg-[#2893cc] text-white text-center font-semibold'
              style={{ width: '-webkit-fill-available' }}
              href={pageUrl}
            >
              Abrir exportações
            </Button>
          </Section>
          <Section>
            <Text className='text-[14px] leading-6.5 font-light'>
              O arquivo contém dados pessoais. Guarde-o com segurança e apague-o
              quando não precisar mais dele.
            </Text>
          </Section>
          <EmailFooter />
        </Container>
      </Body>
    </Tailwind>
  </Html>
)

export default WorkspaceExportReady
