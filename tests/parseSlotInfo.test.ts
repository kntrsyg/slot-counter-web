import assert from 'node:assert/strict'
import test from 'node:test'
import { parseSlotInfo } from '../src/utils/parseSlotInfo'

test('設定1〜6と1/xxx表記を項目ごとに抽出する', () => {
  const parsed = parseSlotInfo(`
BIG確率
設定1 1/273
設定2 1/270
設定3 1/260
設定4 1/250
設定5 1/240
設定6 1/230
REG確率
設定1 430分の1
設定2 390分の1
設定3 350分の1
設定4 310分の1
設定5 290分の1
設定6 250分の1
`, 'サンプル機種｜設定判別・解析')

  assert.equal(parsed.machineName, 'サンプル機種')
  assert.deepEqual(parsed.items.find((item) => item.itemName === 'BIG')?.values, {
    1: 273, 2: 270, 3: 260, 4: 250, 5: 240, 6: 230,
  })
  assert.equal(parsed.items.find((item) => item.itemName === 'REG')?.values['5'], 290)
})

test('設定見出しと確率が別行の表形式を抽出する', () => {
  const parsed = parseSlotInfo(`
ブドウ確率
設定1 設定2 設定3 設定4 設定5 設定6
1/6.2 1/6.1 1/6.0 1/5.9 1/5.8 1/5.7
`)
  assert.deepEqual(parsed.items[0]?.values, {
    1: 6.2, 2: 6.1, 3: 6, 4: 5.9, 5: 5.8, 6: 5.7,
  })
})
