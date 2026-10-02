import { describe, expect, it } from 'vitest'
import {
  SD_RISK_FACTOR_SPECS,
  SD_RISK_FACTORS,
  SD_RISK_LEVEL_COLOR,
  SD_RISK_LEVEL_LABEL,
  SD_RISK_THRESHOLDS,
  sdRiskFactorSpec,
  sdRiskLevel,
  sdRiskScore,
} from '../servicedesk/risk'

describe('catálogo de fatores de risco', () => {
  it('should describe every factor exactly once', () => {
    const keys = SD_RISK_FACTOR_SPECS.map((f) => f.key)

    expect(new Set(keys).size).toBe(keys.length)
    expect([...keys].sort()).toEqual([...SD_RISK_FACTORS].sort())
  })

  it('should keep the weights adding up to 100', () => {
    const total = SD_RISK_FACTOR_SPECS.reduce((sum, f) => sum + f.weight, 0)

    expect(total).toBe(100)
  })

  it('should label every factor in pt-BR', () => {
    for (const factor of SD_RISK_FACTOR_SPECS) {
      expect(factor.label.length).toBeGreaterThan(3)
      expect(factor.weight).toBeGreaterThan(0)
    }
  })

  it('should find a factor by key and ignore an unknown one', () => {
    expect(sdRiskFactorSpec('sla_consumed')?.weight).toBe(30)
    expect(sdRiskFactorSpec('nao_existe')).toBeUndefined()
  })
})

describe('sdRiskLevel', () => {
  it('should put a low score in the LOW band', () => {
    expect(sdRiskLevel(0)).toBe('LOW')
    expect(sdRiskLevel(SD_RISK_THRESHOLDS.medium - 1)).toBe('LOW')
  })

  it('should put a score on the threshold in the higher band', () => {
    expect(sdRiskLevel(SD_RISK_THRESHOLDS.medium)).toBe('MEDIUM')
    expect(sdRiskLevel(SD_RISK_THRESHOLDS.high)).toBe('HIGH')
  })

  it('should clamp a score above the scale to HIGH', () => {
    expect(sdRiskLevel(180)).toBe('HIGH')
  })

  it('should label and color every band', () => {
    for (const level of ['LOW', 'MEDIUM', 'HIGH'] as const) {
      expect(SD_RISK_LEVEL_LABEL[level]).toMatch(/Risco/)
      expect(SD_RISK_LEVEL_COLOR[level]).toMatch(/^[a-z]+$/)
    }
  })
})

describe('sdRiskScore', () => {
  it('should add the factors that applied', () => {
    const score = sdRiskScore([
      {
        key: 'sla_consumed',
        label: 'Prazo já consumido',
        weight: 24,
        detail: '80% do prazo consumido',
      },
      {
        key: 'unassigned',
        label: 'Sem responsável',
        weight: 12,
        detail: 'Ninguém assumiu',
      },
    ])

    expect(score).toBe(36)
  })

  it('should never go past 100', () => {
    const score = sdRiskScore(
      SD_RISK_FACTOR_SPECS.map((f) => ({
        key: f.key,
        label: f.label,
        weight: f.weight * 2,
        detail: 'teto',
      })),
    )

    expect(score).toBe(100)
  })

  it('should ignore a negative weight instead of discounting the score', () => {
    const score = sdRiskScore([
      {
        key: 'priority',
        label: 'Prioridade alta',
        weight: 12,
        detail: 'Crítica',
      },
      {
        key: 'stale',
        label: 'Parado há muito tempo',
        weight: -50,
        detail: 'ruído',
      },
    ])

    expect(score).toBe(12)
  })

  it('should be zero when nothing applied', () => {
    expect(sdRiskScore([])).toBe(0)
  })
})
