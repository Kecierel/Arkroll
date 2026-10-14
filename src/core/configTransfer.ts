import { PROFESSIONS, type ExportedConfig, type LocalConfig, type Operator } from '../types'
import { normalizeConfig } from './storage'

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
export function exportConfig(config: LocalConfig): ExportedConfig { return { ...config, exportedAt: new Date().toISOString() } }
export function parseImport(text: string, operators: Operator[]): LocalConfig {
  let value: unknown
  try { value = JSON.parse(text) as unknown } catch { throw new Error('导入文件不是有效的 JSON。') }
  if (!record(value) || value.configVersion !== 1 || !record(value.operatorStates) || !record(value.settings) || typeof value.settings.ownedOnly !== 'boolean') throw new Error('导入文件格式无效或版本不受支持。')
  for (const state of Object.values(value.operatorStates)) if (!record(state) || typeof state.owned !== 'boolean' || typeof state.enabled !== 'boolean') throw new Error('干员状态格式无效。')
  if (value.locks !== undefined && (!record(value.locks) || PROFESSIONS.some(p => typeof (value.locks as Record<string, unknown>)[p] !== 'boolean'))) throw new Error('锁定状态格式无效。')
  if (value.currentResult !== undefined && (!record(value.currentResult) || PROFESSIONS.some(p => { const id = (value.currentResult as Record<string, unknown>)[p]; return id !== null && (typeof id !== 'string' || !operators.some(o => o.id === id && o.profession === p)) }))) throw new Error('当前结果格式无效。')
  return normalizeConfig(value, operators)
}
