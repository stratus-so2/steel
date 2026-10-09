import { ButtonLink } from '@/components/button-link'
import { H1 } from '@/components/typography/heading/h1'
import { Muted } from '@/components/typography/text/muted'

/**
 * 404 for `notFound()` inside the public site (an unknown docs page, changelog
 * entry...). It renders inside the `(web)` layout, so the visitor keeps the
 * site header and footer to find their way back.
 */
export default function WebNotFound() {
  return (
    <main className='mx-auto flex w-full max-w-xl flex-col items-start gap-4 px-4 py-24 sm:px-8'>
      <Muted className='font-mono text-xs uppercase tracking-widest'>
        Erro 404
      </Muted>
      <H1 className='text-left'>Página não encontrada</H1>
      <Muted>
        O endereço que você abriu não existe ou mudou de lugar. Confira o link
        ou volte por um dos caminhos abaixo.
      </Muted>
      <div className='flex flex-wrap gap-2 pt-2'>
        <ButtonLink href='/docs' size='sm'>
          Ver a documentação
        </ButtonLink>
        <ButtonLink href='/changelog' variant='outline' size='sm'>
          Novidades
        </ButtonLink>
      </div>
    </main>
  )
}
