import type { SettingValue, SlotMachine } from '../types'

export async function searchMachineInfo(machineName: string): Promise<SlotMachine[]> {
  // TODO: 正規のWeb検索APIを接続し、機種名から候補ページを取得する。
  void machineName
  return []
}

export async function fetchMachineInfoFromUrl(url: string): Promise<string> {
  // TODO: 利用規約・CORS・著作権を確認したサーバー側取得処理へ接続する。
  void url
  return ''
}

export function parseSettingValues(text: string): SettingValue[] {
  // TODO: 取得テキストをユーザー確認可能な設定参考値候補へ変換する。
  void text
  return []
}
