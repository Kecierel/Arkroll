import type { ExportedConfig, LocalConfig, Operator } from '../types'
import { normalizeConfig } from './storage'
import { isRecord, isRecruitCount, normalizeLineup } from './lineup'
import { normalizeSessions } from './sessions'
import { normalizeHistory } from './history'

export function exportConfig(config: LocalConfig): ExportedConfig { return { ...config, exportedAt: new Date().toISOString() } }
export function parseImport(text: string, operators: Operator[]): LocalConfig {
  let value: unknown
  try { value = JSON.parse(text) as unknown } catch { throw new Error('导入文件不是有效的 JSON。') }
  if (!isRecord(value) || (value.configVersion !== 1 && value.configVersion !== 2) || !isRecord(value.operatorStates)) throw new Error('导入文件格式无效或版本不受支持。')
  for (const state of Object.values(value.operatorStates)) if (!isRecord(state) || typeof state.owned !== 'boolean' || typeof state.enabled !== 'boolean') throw new Error('干员状态格式无效。')
  const legacy = value.configVersion === 1
  if (!legacy && !isRecruitCount(value.recruitCount)) throw new Error('每职业人数无效。')
  const count = !legacy && isRecruitCount(value.recruitCount) ? value.recruitCount : 1
  normalizeLineup(value.currentResult, value.locks, operators, count, legacy, true)
  normalizeSessions(value.sessions, operators, count, legacy, true)
  if (value.history !== undefined) normalizeHistory(value.history)
  return normalizeConfig(value, operators)
}
