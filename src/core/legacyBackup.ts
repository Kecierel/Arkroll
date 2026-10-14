import type { LocalConfig, Operator } from '../types'
import { parseImport } from './configTransfer'

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Accept V0.1 SAMPLE backups while retaining strict validation for other IDs. */
export function parseBackupWithMigration(text: string, operators: Operator[]): { config: LocalConfig; discardedSample: boolean } {
  let value: unknown
  try { value = JSON.parse(text.replace(/^\uFEFF/, '')) as unknown }
  catch { throw new Error('导入文件不是有效的 JSON。') }
  if (!record(value)) throw new Error('导入文件格式无效。')
  let discardedSample = false
  if (record(value.operatorStates)) {
    discardedSample = Object.keys(value.operatorStates).some(id => id.startsWith('sample_'))
  }
  if (record(value.currentResult)) {
    const currentResult = { ...value.currentResult }
    for (const [profession, id] of Object.entries(currentResult)) {
      if (typeof id === 'string' && id.startsWith('sample_')) {
        currentResult[profession] = null
        discardedSample = true
      }
    }
    value = { ...value, currentResult }
  }
  return { config: parseImport(JSON.stringify(value), operators), discardedSample }
}
