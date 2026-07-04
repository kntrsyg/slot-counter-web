import type { MachineInfoFetchResponse, SettingValue, SlotMachine } from '../types'
import { parseSlotInfo } from '../utils/parseSlotInfo'
import { fetchMachineInfo } from './machineInfoFetcher'

export async function searchMachineInfo(machineName: string): Promise<SlotMachine[]> {
  // TODO: 正規のWeb検索APIを接続し、機種名から候補ページを取得する。
  void machineName
  return []
}

export async function fetchMachineInfoFromUrl(url: string): Promise<MachineInfoFetchResponse> {
  return fetchMachineInfo(url)
}

export function parseSettingValues(text: string): SettingValue[] {
  return parseSlotInfo(text).items.flatMap((item) => Object.entries(item.values).map(([settingNumber, probability]) => ({
    id: crypto.randomUUID(),
    itemName: item.itemName,
    settingNumber: Number(settingNumber),
    probability,
  })))
}
