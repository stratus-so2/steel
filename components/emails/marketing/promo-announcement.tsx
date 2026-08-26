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
import { EmailFooter } from '@/components/emails/_components/email-footer'

export type PromoAnnouncementEmailProps = {
  heading: string
  subheading?: string
  body: string
  imageUrl?: string
  ctaLabel?: string
  ctaUrl?: string
}

export const PromoAnnouncementEmail = ({
  heading,
  subheading,
  body,
  imageUrl,
  ctaLabel,
  ctaUrl,
}: PromoAnnouncementEmailProps) => (
  <Html>
    <Head />
    <Tailwind>
      <Body className='bg-[#f4f5f5] font-sans py-6'>
        <Preview>{subheading || heading}</Preview>
        <Container className='bg-white mx-auto py-10 px-6 max-w-140'>
          {imageUrl ? (
            <Img
              className='w-full h-auto mb-8 rounded-md'
              src={imageUrl}
              alt={heading}
            />
          ) : null}
          <Section>
            <Text className='text-2xl leading-6.5'>
              <strong>{heading}</strong>
            </Text>
            {subheading ? (
              <Text className='text-[15px] leading-6.5 text-slate-600'>
                {subheading}
              </Text>
            ) : null}
            {body
              .split('\n')
              .filter((paragraph) => paragraph.trim().length > 0)
              .map((paragraph, index) => (
                <Text
                  key={`${index}-${paragraph.slice(0, 12)}`}
                  className='text-[14px] leading-6.5 font-light'
                >
                  {paragraph}
                </Text>
              ))}
            {ctaLabel && ctaUrl ? (
              <Button
                className='rounded-sm py-3 px-2.5 mt-4 bg-[#2893cc] text-white text-center font-semibold'
                style={{ width: '-webkit-fill-available' }}
                href={ctaUrl}
              >
                {ctaLabel}
              </Button>
            ) : null}
          </Section>
          <EmailFooter />
        </Container>
      </Body>
    </Tailwind>
  </Html>
)

export default PromoAnnouncementEmail
