import type { SettingValue } from '../types'

export function probability(totalGames: number, count: number): number | null {
  if (totalGames <= 0 || count <= 0) return null
  return totalGames / count
}

export function probabilityText(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '-' : `1/${value.toFixed(1)}`
}

export function nearestSetting(current: number | null, values: SettingValue[]): number | null {
  if (current === null || !values.length) return null
  return values.reduce((nearest, candidate) =>
    Math.abs(candidate.probability - current) < Math.abs(nearest.probability - current)
      ? candidate
      : nearest,
  ).settingNumber
}
