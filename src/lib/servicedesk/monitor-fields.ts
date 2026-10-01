/**
 * Contrato de campos da entrada de monitoramento, sem nada de servidor —
 * a tela de configuração, a documentação da API e o parser
 * (`./monitoring.ts`) leem **daqui**, para o snippet mostrado ao
 * administrador nunca divergir do que a rota aceita.
 */

/** Campos do script do tipo de mídia "Webhook" do Zabbix → macro. */
export const SD_ZABBIX_MEDIA_TYPE_FIELDS = [
  ['eventId', '{EVENT.ID}'],
  ['eventValue', '{EVENT.VALUE}'],
  ['eventStatus', '{EVENT.STATUS}'],
  ['eventName', '{EVENT.NAME}'],
  ['eventSeverity', '{EVENT.SEVERITY}'],
  ['eventDate', '{EVENT.DATE}'],
  ['eventTime', '{EVENT.TIME}'],
  ['eventTags', '{EVENT.TAGS}'],
  ['hostName', '{HOST.NAME}'],
  ['hostIp', '{HOST.IP}'],
  ['message', '{ALERT.MESSAGE}'],
] as const

/** Corpo pronto para colar no parâmetro do script do Zabbix. */
export function sdZabbixPayloadExample(): string {
  const body = SD_ZABBIX_MEDIA_TYPE_FIELDS.map(
    ([field, macro]) => `  "${field}": "${macro}"`,
  ).join(',\n')
  return `{\n${body}\n}`
}

/** Corpo mínimo aceito de um webhook genérico. */
export const SD_GENERIC_PAYLOAD_EXAMPLE = `{
  "externalId": "cpu-srv02",
  "status": "PROBLEM",
  "severity": "high",
  "host": "srv-02",
  "subject": "CPU acima de 90%",
  "body": "Média de 5 minutos em 94%"
}`
