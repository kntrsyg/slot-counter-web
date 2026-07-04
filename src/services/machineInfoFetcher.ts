import type { MachineInfoFetchResponse } from '../types'

export async function fetchMachineInfo(url: string): Promise<MachineInfoFetchResponse> {
  const response = await fetch('/api/fetch-machine-info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })

  let result: MachineInfoFetchResponse
  try {
    result = await response.json() as MachineInfoFetchResponse
  } catch {
    throw new Error('取得サーバーから正しい応答がありませんでした。')
  }

  if (!response.ok || !result.success) {
    throw new Error(result.error || '自動取得できませんでした。')
  }
  return result
}
