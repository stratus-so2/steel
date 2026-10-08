import type { IconSvgElement } from '@hugeicons/react'
import {
  ArrowRight02Icon,
  Github01Icon,
  ServerStack03Icon,
  SlackIcon,
  WhatsappIcon,
} from '@hugeicons-pro/core-solid-rounded'
import Image from 'next/image'
import Link from 'next/link'
import { SteelIcon } from '@/components/icon/icon'
import { Muted } from '@/components/typography/text/muted'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from '@/components/ui/card'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu'
import { getAllEntriesMeta } from '@/src/lib/changelog/entries'
import { formatChangelogDate } from '@/src/lib/changelog/labels'
import {
  discover,
  featureCapabilities,
  industries,
  learn,
  products,
  scale,
  useCases,
} from './web-header-nav-data'

export async function WebHeader() {
  const [latest] = await getAllEntriesMeta()

  return (
    <header className='mx-auto grid w-full grid-cols-[auto_1fr] items-center gap-2 px-4 lg:grid-cols-[1fr_auto_1fr] lg:gap-0 py-3 sm:px-8 xl:max-w-336 xl:px-11 2xl:max-w-384'>
      <Link href='/' className='justify-self-start'>
        <Image
          src='/brand/logo.svg'
          alt='Steel'
          width={100}
          height={45}
          className='invert dark:invert-0'
        />
      </Link>
      <NavigationMenu className='hidden flex-1 lg:flex'>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger>Produto</NavigationMenuTrigger>
            <NavigationMenuContent className='w-screen py-8'>
              <div className='mx-auto w-full space-y-8 px-4 sm:px-8 xl:max-w-336 xl:px-11 2xl:max-w-384'>
                <div className='grid grid-cols-4 items-start gap-8'>
                  <div className='flex flex-col gap-1.5'>
                    <Muted className='px-2'>Produtos</Muted>
                    <ul className='grid grid-cols-1 gap-4'>
                      {products.map((product) => (
                        <ListItem
                          key={product.title}
                          title={product.title}
                          href={product.href}
                          icon={product.icon}
                        >
                          <span className='text-sm'>{product.description}</span>
                        </ListItem>
                      ))}
                    </ul>
                  </div>
                  <div className='col-span-2 flex flex-col gap-1.5'>
                    <Muted className='px-2'>Capacidades de Recursos</Muted>
                    <ul className='grid grid-cols-2 gap-4'>
                      {featureCapabilities.map((feature) => (
                        <ListItem
                          key={feature.title}
                          title={feature.title}
                          href={feature.href}
                          icon={feature.icon}
                        >
                          <span className='text-sm'>{feature.description}</span>
                        </ListItem>
                      ))}
                    </ul>
                  </div>
                  <div className='flex flex-col gap-4'>
                    <Card className='bg-muted border border-brand-500'>
                      <CardContent className='space-y-1.5'>
                        <SteelIcon icon={ServerStack03Icon} size={20} />
                        <CardTitle>Seu banco, suas regras</CardTitle>
                        <CardDescription>
                          Aponte um módulo para o seu próprio PostgreSQL, com as
                          credenciais criptografadas.
                        </CardDescription>
                      </CardContent>
                    </Card>
                    <Card className='bg-branding-950 border border-brand-500'>
                      <CardContent className='space-y-2.5'>
                        <CardTitle>Funciona com sua stack</CardTitle>
                        <CardDescription>
                          <div className='flex flex-wrap gap-2'>
                            <Badge className='py-3'>
                              <SteelIcon icon={SlackIcon} />
                              Slack
                            </Badge>
                            <Badge className='py-3'>
                              <SteelIcon icon={Github01Icon} />
                              GitHub
                            </Badge>
                            <Badge className='py-3'>
                              <SteelIcon icon={WhatsappIcon} />
                              WhatsApp
                            </Badge>
                          </div>
                          <Link href='/marketplace'>
                            <Button variant='link' size='sm' className='p-0'>
                              Navegar pelo marketplace
                              <SteelIcon icon={ArrowRight02Icon} size={20} />
                            </Button>
                          </Link>
                        </CardDescription>
                      </CardContent>
                    </Card>
                  </div>
                </div>
                {latest && (
                  <div className='flex items-center justify-between bg-muted/75 rounded-md p-2.5'>
                    <div className='flex items-center gap-2'>
                      <p className='text-sm'>
                        Novidade: {latest.title} |{' '}
                        {formatChangelogDate(latest.date)}
                      </p>
                      <Link
                        href={`/changelog/${latest.slug}`}
                        className={buttonVariants({
                          variant: 'link',
                          size: 'sm',
                        })}
                      >
                        Saiba mais{' '}
                        <SteelIcon icon={ArrowRight02Icon} size={20} />
                      </Link>
                    </div>
                    <Link
                      href='/changelog'
                      className={buttonVariants({
                        variant: 'link',
                        size: 'sm',
                      })}
                    >
                      Ver o changelog
                    </Link>
                  </div>
                )}
              </div>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuTrigger>Soluções</NavigationMenuTrigger>
            <NavigationMenuContent className='w-screen py-8'>
              <div className='mx-auto w-full space-y-8 px-4 sm:px-8 xl:max-w-336 xl:px-11 2xl:max-w-384'>
                <div className='grid grid-cols-4 items-start gap-8'>
                  <div className='flex flex-col gap-1.5'>
                    <Muted className='px-2'>Casos de Uso</Muted>
                    <ul className='grid grid-cols-1 gap-4'>
                      {useCases.map((useCase) => (
                        <ListItem
                          key={useCase.title}
                          title={useCase.title}
                          href={useCase.href}
                          icon={useCase.icon}
                        >
                          <span className='text-sm'>{useCase.description}</span>
                        </ListItem>
                      ))}
                    </ul>
                  </div>
                  <div className='flex flex-col gap-1.5'>
                    <Muted className='px-2'>Setores</Muted>
                    <ul className='grid grid-cols-1 gap-4'>
                      {industries.map((industry) => (
                        <ListItem
                          key={industry.title}
                          title={industry.title}
                          href={industry.href}
                          icon={industry.icon}
                        >
                          <span className='text-sm'>
                            {industry.description}
                          </span>
                        </ListItem>
                      ))}
                    </ul>
                  </div>
                  <div className='flex flex-col gap-1.5'>
                    <Muted className='px-2'>Escala</Muted>
                    <ul className='grid grid-cols-1 gap-4'>
                      {scale.map((size) => (
                        <ListItem
                          key={size.title}
                          title={size.title}
                          href={size.href}
                          icon={size.icon}
                        >
                          <span className='text-sm'>{size.description}</span>
                        </ListItem>
                      ))}
                    </ul>
                  </div>
                  <div className='flex flex-col gap-4 h-full'>
                    <Card className='bg-muted border border-brand-500 h-full'>
                      <CardContent className='flex flex-1 flex-col'>
                        <CardTitle>
                          Veja o Steel com os seus processos
                        </CardTitle>
                        <CardDescription className='mt-1.5'>
                          Mostramos o ServiceDesk, o CRM e o WhatsApp rodando
                          com as filas, os funis e os SLAs do seu time.
                        </CardDescription>
                        <div className='mt-auto pt-4'>
                          <Link
                            href='/talk-to-sales'
                            className={buttonVariants({
                              variant: 'link',
                              size: 'sm',
                              className: 'p-0',
                            })}
                          >
                            Agendar uma demonstração
                            <SteelIcon icon={ArrowRight02Icon} size={20} />
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuTrigger>Recursos</NavigationMenuTrigger>
            <NavigationMenuContent className='w-screen py-8'>
              <div className='mx-auto w-full space-y-8 px-4 sm:px-8 xl:max-w-336 xl:px-11 2xl:max-w-384'>
                <div className='grid grid-cols-4 items-start gap-8'>
                  <div className='flex flex-col gap-1.5'>
                    <Muted className='px-2'>Descobrir</Muted>
                    <ul className='grid grid-cols-1 gap-4'>
                      {discover.map((item) => (
                        <ListItem
                          key={item.title}
                          title={item.title}
                          href={item.href}
                          icon={item.icon}
                        >
                          <span className='text-sm'>{item.description}</span>
                        </ListItem>
                      ))}
                    </ul>
                  </div>
                  <div className='flex flex-col gap-1.5'>
                    <Muted className='px-2'>Aprender</Muted>
                    <ul className='grid grid-cols-1 gap-4'>
                      {learn.map((item) => (
                        <ListItem
                          key={item.title}
                          title={item.title}
                          href={item.href}
                          icon={item.icon}
                        >
                          <span className='text-sm'>{item.description}</span>
                        </ListItem>
                      ))}
                    </ul>
                  </div>
                  <div className='col-span-2 flex gap-4 h-full'>
                    <div className='flex-1 flex flex-col gap-1.5'>
                      <Muted>Última atualização</Muted>
                      <Link
                        href={
                          latest ? `/changelog/${latest.slug}` : '/changelog'
                        }
                        className='h-full'
                      >
                        <Card className='bg-muted border border-brand-500 h-full'>
                          <CardContent className='space-y-1.5 flex flex-col justify-between h-full'>
                            <Badge>
                              {latest
                                ? formatChangelogDate(latest.date)
                                : 'Changelog'}
                            </Badge>
                            <div>
                              <CardTitle className='text-branding-400'>
                                {latest?.title ?? 'Novidades do Steel'}
                              </CardTitle>
                              <CardDescription className='line-clamp-2'>
                                {latest?.summary ??
                                  'Tudo o que entrou no Steel, release a release.'}
                              </CardDescription>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    </div>
                    <div className='flex-1 flex flex-col gap-1.5'>
                      <Muted>Manifesto</Muted>
                      <Link href='/manifesto' className='h-full'>
                        <Card className='bg-muted border border-brand-500 h-full'>
                          <CardContent className='space-y-2.5 flex flex-col justify-between h-full'>
                            <Badge>Leitura</Badge>
                            <div>
                              <CardTitle>Os princípios do Steel</CardTitle>
                              <CardDescription>
                                Como pensamos atendimento, vendas e IA num
                                sistema de registro só.
                              </CardDescription>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuLink
            className={navigationMenuTriggerStyle()}
            render={<Link href='/pricing'>Assinatura</Link>}
          />
          <NavigationMenuLink
            className={navigationMenuTriggerStyle()}
            render={<Link href='/changelog'>Changelog</Link>}
          />
        </NavigationMenuList>
      </NavigationMenu>
      <div className='flex items-center gap-1.5 justify-self-end'>
        <Link href='/talk-to-sales' className='hidden sm:block'>
          <Button variant='ghost' size='sm'>
            Falar com vendas
          </Button>
        </Link>
        <Link href='/sign-in'>
          <Button variant='ghost' size='sm'>
            Entrar
          </Button>
        </Link>
        <Link href='/sign-up'>
          <Button variant='default' size='sm'>
            Comece grátis
          </Button>
        </Link>
      </div>
    </header>
  )
}

function ListItem({
  title,
  children,
  href,
  icon,
  ...props
}: React.ComponentPropsWithoutRef<'li'> & {
  href: string
  icon?: IconSvgElement
}) {
  return (
    <li className='h-full' {...props}>
      <NavigationMenuLink
        className='h-full items-start'
        render={
          <Link href={href}>
            <div className='flex w-full flex-col gap-1 text-sm hover:text-branding-700 hover:dark:text-branding-400'>
              <div className='flex items-center gap-1.5'>
                {icon && <SteelIcon icon={icon} size={20} />}
                <div className='leading-none font-medium'>{title}</div>
              </div>
              <div className='line-clamp-2 text-muted-foreground'>
                {children}
              </div>
            </div>
          </Link>
        }
      />
    </li>
  )
}
