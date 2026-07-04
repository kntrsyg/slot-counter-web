import type { CountItem, SettingValue, SlotMachine } from '../types'

const item = (id: string, name: string, type: CountItem['type']): CountItem => ({ id, name, type })
const referenceValues = (itemName: string, values: number[]): SettingValue[] =>
  values.map((probability, index) => ({
    id: `sample-${itemName}-${index + 1}`,
    itemName,
    settingNumber: index + 1,
    probability,
  }))

export const sampleMachine: SlotMachine = {
  id: 'sample-juggler',
  name: 'サンプルジャグラー',
  memo: '操作確認用のサンプルデータです。表示値は設定判別の参考情報としてご利用ください。',
  sourceUrl: '',
  createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  countItems: [
    item('sample-big', 'BIG', 'bonus'),
    item('sample-reg', 'REG', 'bonus'),
    item('sample-grape', 'ブドウ', 'smallRole'),
    item('sample-cherry', 'チェリー', 'rareRole'),
  ],
  settingValues: [
    ...referenceValues('BIG', [273, 270, 260, 250, 240, 230]),
    ...referenceValues('REG', [430, 390, 350, 310, 290, 250]),
    ...referenceValues('ブドウ', [6.2, 6.1, 6.0, 5.9, 5.8, 5.7]),
  ],
}
