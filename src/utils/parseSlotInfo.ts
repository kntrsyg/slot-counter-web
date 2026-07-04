import type { ParsedSlotInfo, ParsedSlotItem } from '../types'

const ITEM_ALIASES: Array<[string, string]> = [
  ['弱チェリー確率', '弱チェリー'],
  ['強チェリー確率', '強チェリー'],
  ['チャンス目確率', 'チャンス目'],
  ['ボーナス合算', '合算'],
  ['チェリー確率', 'チェリー'],
  ['ブドウ確率', 'ブドウ'],
  ['ぶどう確率', 'ブドウ'],
  ['スイカ確率', 'スイカ'],
  ['BIG確率', 'BIG'],
  ['REG確率', 'REG'],
  ['弱チェリー', '弱チェリー'],
  ['強チェリー', '強チェリー'],
  ['チャンス目', 'チャンス目'],
  ['チェリー', 'チェリー'],
  ['ブドウ', 'ブドウ'],
  ['ぶどう', 'ブドウ'],
  ['スイカ', 'スイカ'],
  ['合算', '合算'],
  ['BIG', 'BIG'],
  ['REG', 'REG'],
]

const SETTING_PROBABILITY_PATTERN = /設定\s*([1-6])\s*(?:の?確率)?\s*[:：=＝\-–—]?\s*(?:1\s*[\/／]\s*([0-9]+(?:\.[0-9]+)?)|([0-9]+(?:\.[0-9]+)?)\s*分の\s*1)/gi
const SETTING_PATTERN = /設定\s*([1-6])/g
const PROBABILITY_PATTERN = /(?:1\s*[\/／]\s*([0-9]+(?:\.[0-9]+)?)|([0-9]+(?:\.[0-9]+)?)\s*分の\s*1)/g

type SettingKey = '1' | '2' | '3' | '4' | '5' | '6'

function detectItem(line: string): string | null {
  const normalized = line.toUpperCase()
  for (const [alias, canonical] of ITEM_ALIASES) {
    if (normalized.includes(alias.toUpperCase())) return canonical
  }
  return null
}

function allSettings(line: string): number[] {
  return [...line.matchAll(SETTING_PATTERN)].map((match) => Number(match[1]))
}

function allProbabilities(line: string): number[] {
  return [...line.matchAll(PROBABILITY_PATTERN)]
    .map((match) => Number(match[1] ?? match[2]))
    .filter((value) => Number.isFinite(value) && value > 0)
}

function titleToMachineName(title: string): string {
  return title
    .split(/[|｜–—]/)[0]
    .replace(/設定判別|解析|スペック|機種情報/gi, '')
    .trim()
}

export function parseSlotInfo(text: string, title = ''): ParsedSlotInfo {
  const lines = text
    .replace(/\r/g, '\n')
    .split(/\n+/)
    .map((line) => line.replace(/[\t\u00a0]+/g, ' ').replace(/\s{2,}/g, ' ').trim())
    .filter(Boolean)

  const valuesByItem = new Map<string, Map<number, number>>()
  let currentItem: string | null = null
  let pendingSettings: number[] = []

  const addValue = (itemName: string, setting: number, value: number) => {
    if (setting < 1 || setting > 6 || !Number.isFinite(value) || value <= 0) return
    const values = valuesByItem.get(itemName) ?? new Map<number, number>()
    if (!values.has(setting)) values.set(setting, value)
    valuesByItem.set(itemName, values)
  }

  for (const line of lines) {
    const detected = detectItem(line)
    if (detected) {
      currentItem = detected
      pendingSettings = []
      if (!valuesByItem.has(detected)) valuesByItem.set(detected, new Map())
    }
    if (!currentItem) continue

    const directMatches = [...line.matchAll(SETTING_PROBABILITY_PATTERN)]
    if (directMatches.length) {
      for (const match of directMatches) {
        addValue(currentItem, Number(match[1]), Number(match[2] ?? match[3]))
      }
      continue
    }

    const settings = allSettings(line)
    const probabilities = allProbabilities(line)
    if (settings.length && probabilities.length) {
      settings.slice(0, probabilities.length).forEach((setting, index) => addValue(currentItem!, setting, probabilities[index]))
      pendingSettings = []
    } else if (settings.length) {
      pendingSettings = settings
    } else if (probabilities.length && pendingSettings.length) {
      pendingSettings.slice(0, probabilities.length).forEach((setting, index) => addValue(currentItem!, setting, probabilities[index]))
      pendingSettings = []
    } else if (probabilities.length >= 6 && detected) {
      probabilities.slice(0, 6).forEach((value, index) => addValue(currentItem!, index + 1, value))
    }
  }

  const items: ParsedSlotItem[] = [...valuesByItem.entries()]
    .map(([itemName, settingMap]) => ({
      itemName,
      values: Object.fromEntries([...settingMap.entries()].map(([setting, value]) => [String(setting) as SettingKey, value])),
    }))
    .filter((item) => Object.keys(item.values).length > 0)

  return {
    machineName: titleToMachineName(title),
    items,
  }
}
