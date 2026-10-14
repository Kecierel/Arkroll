import { PROFESSIONS, type LocalConfig, type Operator, type OperatorStateMap } from '../types'
import { blankLocks, blankResult } from './randomizer'

export const STORAGE_KEY = 'arknights-is-randomizer:v1'
export const defaultConfig = (operators: Operator[]): LocalConfig => ({ configVersion: 1, operatorStates: Object.fromEntries(operators.map(o => [o.id, { owned: false, enabled: true }])) as OperatorStateMap, settings: { ownedOnly: false }, locks: blankLocks(), currentResult: blankResult() })
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
export function normalizeConfig(value: unknown, operators: Operator[]): LocalConfig {
  const base = defaultConfig(operators)
  if (!isRecord(value) || value.configVersion !== 1) return base
  const rawStates = isRecord(value.operatorStates) ? value.operatorStates : {}
  for (const operator of operators) {
    const state = rawStates[operator.id]
    if (isRecord(state)) base.operatorStates[operator.id] = { owned: typeof state.owned === 'boolean' ? state.owned : false, enabled: typeof state.enabled === 'boolean' ? state.enabled : true }
  }
  if (isRecord(value.settings) && typeof value.settings.ownedOnly === 'boolean') base.settings.ownedOnly = value.settings.ownedOnly
  if (isRecord(value.locks)) for (const p of PROFESSIONS) if (typeof value.locks[p] === 'boolean') base.locks[p] = value.locks[p] as boolean
  if (isRecord(value.currentResult)) for (const p of PROFESSIONS) {
    const id = value.currentResult[p]
    if (typeof id === 'string' && operators.some(o => o.id === id && o.profession === p)) base.currentResult[p] = id
  }
  return base
}
export function loadConfig(operators: Operator[]): { config: LocalConfig; warning: boolean; migratedSample: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { config: defaultConfig(operators), warning: false, migratedSample: false }
    const parsed: unknown = JSON.parse(raw)
    const sampleStates = isRecord(parsed) && isRecord(parsed.operatorStates) && Object.keys(parsed.operatorStates).some(id => id.startsWith('sample_'))
    const config = normalizeConfig(parsed, operators)
    if (sampleStates) saveConfig(config)
    return { config, warning: false, migratedSample: Boolean(sampleStates) }
  } catch { return { config: defaultConfig(operators), warning: true, migratedSample: false } }
}
export function saveConfig(config: LocalConfig): boolean {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); return true } catch { return false }
}
