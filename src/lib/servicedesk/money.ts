import { Prisma } from '@prisma/client'

type DecimalLike = Prisma.Decimal | string | number

/**
 * Valores monetários dos chamados (custos e peças) com aritmética decimal
 * exata (`Prisma.Decimal`) e serialização com 2 casas (`"129.90"`).
 */

/** Quantidade × valor unitário, arredondado em centavos. */
export function sdLineTotal(
  quantity: DecimalLike,
  unitCost: DecimalLike,
): Prisma.Decimal {
  return new Prisma.Decimal(quantity)
    .mul(unitCost)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
}

export function sdSum(values: DecimalLike[]): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>(
    (sum, value) => sum.add(value),
    new Prisma.Decimal(0),
  )
}

/** `"1234.50"`. */
export function sdMoney(value: DecimalLike): string {
  return new Prisma.Decimal(value).toFixed(2)
}
