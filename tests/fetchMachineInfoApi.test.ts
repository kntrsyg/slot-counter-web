import assert from 'node:assert/strict'
import test from 'node:test'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import handler from '../api/fetch-machine-info'

function responseRecorder() {
  const record: { statusCode: number; body: unknown } = { statusCode: 200, body: undefined }
  const response = {
    setHeader: () => response,
    status: (code: number) => { record.statusCode = code; return response },
    json: (body: unknown) => { record.body = body; return response },
  } as unknown as VercelResponse
  return { response, record }
}

test('GET要求を拒否する', async () => {
  const { response, record } = responseRecorder()
  await handler({ method: 'GET', headers: {} } as VercelRequest, response)
  assert.equal(record.statusCode, 405)
})

test('ローカルIPのURL取得を拒否する', async () => {
  const { response, record } = responseRecorder()
  await handler({ method: 'POST', headers: {}, body: { url: 'http://127.0.0.1/private' } } as VercelRequest, response)
  assert.equal(record.statusCode, 422)
  assert.match((record.body as { error: string }).error, /ローカルネットワーク/)
})
