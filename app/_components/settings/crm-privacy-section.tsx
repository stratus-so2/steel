'use client'

import { useCookieConsent } from '@/app/_components/user/cookie-consent/provider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'

export function CrmPrivacySection() {
  const { consent, setConsent } = useCookieConsent()
  const accepted = consent === 'accepted'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Privacidade</CardTitle>
      </CardHeader>
      <CardContent>
        <div className='flex items-center justify-between gap-4'>
          <div className='space-y-1'>
            <p className='font-medium text-sm'>Cookies de análise</p>
            <p className='text-muted-foreground text-sm'>
              {consent === null
                ? 'Você ainda não decidiu sobre o uso de cookies de análise.'
                : accepted
                  ? 'Aceitos. Você pode revogar a qualquer momento.'
                  : 'Recusados. Nenhum tracker de análise é carregado.'}
            </p>
          </div>
          <Switch
            checked={accepted}
            onCheckedChange={(next) =>
              setConsent(next ? 'accepted' : 'rejected')
            }
          />
        </div>
      </CardContent>
    </Card>
  )
}
