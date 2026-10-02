import { format, formatDistanceToNow, isThisYear, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'

/**
 * Horário curto da linha da lista, como num cliente de e-mail: hoje mostra a
 * hora, no ano corrente o dia e o mês, antes disso a data completa.
 */
export function notificationShortTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  if (isToday(date)) return format(date, 'HH:mm', { locale: ptBR })
  if (isThisYear(date)) return format(date, "d 'de' MMM", { locale: ptBR })
  return format(date, 'dd/MM/yyyy', { locale: ptBR })
}

/** Data absoluta completa (tooltip da lista e cabeçalho do painel). */
export function notificationAbsoluteDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return format(date, "d 'de' MMMM 'de' yyyy', às' HH:mm", { locale: ptBR })
}

/** "há 5 minutos". */
export function notificationRelativeTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return formatDistanceToNow(date, { addSuffix: true, locale: ptBR })
}
