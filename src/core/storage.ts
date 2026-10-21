import { PROFESSIONS, type LocalConfig, type Operator, type OperatorStateMap } from '../types'
import { blankLocks, blankResult } from './randomizer'
import { normalizeHistory } from './history'
import { DEFAULT_THEME_ID, IS_THEMES, isISThemeId } from '../data/themes'
import { getOpeningSettings, normalizeOpeningSettings } from './opening'
import { normalizeSessions } from './sessions'

export const STORAGE_KEY = 'arknights-is-randomizer:v1'
export const defaultConfig = (operators: Operator[]): LocalConfig => ({ configVersion: 1, selectedTheme: DEFAULT_THEME_ID, operatorStates: Object.fromEntries(operators.map(o => [o.id, { owned: false, enabled: true }])) as OperatorStateMap, locks: blankLocks(), currentResult: blankResult() })
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
export function normalizeConfig(value: unknown, operators: Operator[]): LocalConfig {
  const base = defaultConfig(operators)
  if (!isRecord(value) || value.configVersion !== 1) return base
  if (isISThemeId(value.selectedTheme)) base.selectedTheme = value.selectedTheme
  if (value.randomMode === 'full' || value.randomMode === 'eight' || value.randomMode === 'single') base.randomMode = value.randomMode
  if (value.sessions !== undefined) base.sessions = normalizeSessions(value.sessions, operators)
  if (value.phantomOpening !== undefined) base.phantomOpening = normalizeOpeningSettings(value.phantomOpening)
  if (isRecord(value.themeOpenings)) {
    base.themeOpenings = {}
    for (const theme of IS_THEMES) if (value.themeOpenings[theme.id] !== undefined) base.themeOpenings[theme.id] = normalizeOpeningSettings(value.themeOpenings[theme.id], theme.id)
  }
  for (const theme of IS_THEMES) {
    const full = base.sessions?.[`full:${theme.id}`], settings = getOpeningSettings(base, theme.id)
    if (full) {
      if (full.squad && settings.excludedSquads.includes(full.squad)) { full.squad = null; full.squadLocked = false }
      if (full.recruit && settings.excludedRecruits.includes(full.recruit)) { full.recruit = null; full.recruitLocked = false }
    }
  }
  const rawStates = isRecord(value.operatorStates) ? value.operatorStates : {}
  if (value.history !== undefined) base.history = normalizeHistory(value.history)
  for (const operator of operators) {
    const state = rawStates[operator.id]
    if (isRecord(state)) base.operatorStates[operator.id] = { owned: typeof state.owned === 'boolean' ? state.owned : false, enabled: typeof state.enabled === 'boolean' ? state.enabled : true }
  }
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
    // Keep personal settings, but start each page load with an undrawn lineup.
    // Backup normalization remains separate so explicit imports can restore results.
    config.currentResult = blankResult()
    delete config.sessions
    if (sampleStates) saveConfig(config)
    return { config, warning: false, migratedSample: Boolean(sampleStates) }
  } catch { return { config: defaultConfig(operators), warning: true, migratedSample: false } }
}
export function saveConfig(config: LocalConfig): boolean {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); return true } catch { return false }
}
