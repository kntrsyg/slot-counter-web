export type CountItemType = 'bonus' | 'smallRole' | 'rareRole' | 'custom'

export interface CountItem {
  id: string
  name: string
  type: CountItemType
}

export interface SettingValue {
  id: string
  itemName: string
  settingNumber: number
  probability: number
}

export interface SlotMachine {
  id: string
  name: string
  memo: string
  sourceUrl: string
  createdAt: string
  countItems: CountItem[]
  settingValues: SettingValue[]
}

export interface PlaySession {
  id: string
  machineId: string
  machineName: string
  totalGames: number
  counts: Record<string, number>
  memo: string
  startedAt: string
  savedAt: string
}

export interface ParsedSlotItem {
  itemName: string
  values: Partial<Record<'1' | '2' | '3' | '4' | '5' | '6', number>>
}

export interface ParsedSlotInfo {
  machineName: string
  items: ParsedSlotItem[]
}

export interface MachineInfoFetchResponse {
  success: boolean
  title?: string
  text?: string
  sourceUrl?: string
  parsed?: ParsedSlotInfo
  error?: string
}
