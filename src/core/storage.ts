import { normalizeLineup, isRecruitCount, isRecord } from './lineup'
import type { LocalConfig, Operator, OperatorStateMap } from '../types'
import { blankLocks, blankResult } from './randomizer'
import { normalizeMaaSnapshot } from './maaSnapshot'
import { normalizeTraining } from './training'
import { normalizeHistory } from './history'
import { DEFAULT_THEME_ID, IS_THEMES, isISThemeId } from '../data/themes'
import { getOpeningSettings, normalizeOpeningSettings } from './opening'
import { normalizeSessions } from './sessions'

export const STORAGE_KEY = 'arknights-is-randomizer:v1'
export const defaultConfig = (operators: Operator[]): LocalConfig => ({ configVersion: 2, recruitCount: 1, trainingThreshold: 0, noticesEnabled: true, selectedTheme: DEFAULT_THEME_ID, operatorStates: Object.fromEntries(operators.map(o => [o.id, { owned: false, enabled: true }])) as OperatorStateMap, locks: blankLocks(), currentResult: blankResult() })
export function normalizeConfig(value: unknown, operators: Operator[]): LocalConfig {
  const base = defaultConfig(operators)
  if (!isRecord(value) || (value.configVersion !== 1 && value.configVersion !== 2)) return base
  const legacy = value.configVersion === 1
  base.recruitCount = !legacy && isRecruitCount(value.recruitCount) ? value.recruitCount : 1
  const lineup = normalizeLineup(value.currentResult, value.locks, operators, base.recruitCount, legacy)
  base.currentResult = lineup.result
  base.locks = lineup.locks
  const maaSnapshot = normalizeMaaSnapshot(value.maaSnapshot, operators)
  if (maaSnapshot) base.maaSnapshot = maaSnapshot
  if (value.operatorTraining !== undefined) base.operatorTraining = normalizeTraining(value.operatorTraining, operators)
  if (value.trainingThreshold === 0 || value.trainingThreshold === 1 || value.trainingThreshold === 60) base.trainingThreshold = value.trainingThreshold
  if (typeof value.noticesEnabled === 'boolean') base.noticesEnabled = value.noticesEnabled
  if (isISThemeId(value.selectedTheme)) base.selectedTheme = value.selectedTheme
  if (value.randomMode === 'full' || value.randomMode === 'eight' || value.randomMode === 'single') base.randomMode = value.randomMode
  if (value.sessions !== undefined) base.sessions = normalizeSessions(value.sessions, operators, base.recruitCount, legacy)
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
  return base
}
export function loadConfig(operators: Operator[]): { config: LocalConfig; warning: boolean; migratedSample: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { config: defaultConfig(operators), warning: false, migratedSample: false }
    const parsed: unknown = JSON.parse(raw)
    const sampleStates = isRecord(parsed) && isRecord(parsed.operatorStates) && Object.keys(parsed.operatorStates).some(id => id.startsWith('sample_'))
    const config = normalizeConfig(parsed, operators)
    // Keep personal settings, but reset results and their locks together on page load.
    // Backup normalization remains separate so explicit imports can restore results.
    config.currentResult = blankResult(config.recruitCount)
    config.locks = blankLocks(config.recruitCount)
    delete config.sessions
    if (sampleStates) saveConfig(config)
    return { config, warning: false, migratedSample: Boolean(sampleStates) }
  } catch { return { config: defaultConfig(operators), warning: true, migratedSample: false } }
}
export function saveConfig(config: LocalConfig): boolean {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); return true } catch { return false }
}
