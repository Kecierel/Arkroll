import { PROFESSIONS, type DrawRecord, type LocalConfig, type Operator, type RandomMode } from '../types'
import { DEFAULT_THEME_ID, IS_THEMES, isISThemeId } from '../data/themes'
import { getThemeOpening } from '../data/openings'
import { getOpeningSettings } from './opening'
import { getSession, MODES, putSession } from './sessions'
import { blankResult } from './randomizer'
import { eligibleFor } from './operatorPool'
import { isRecord, isRecruitCount, setRecruitCount } from './lineup'

export const HISTORY_LIMIT = 30
export const FAVORITE_LIMIT = 100
export function normalizeHistory(value: unknown): DrawRecord[] {
  if (!Array.isArray(value)) throw new Error('历史记录格式无效。')
  const ids = new Set<string>()
  const rows = value.map((row: unknown): DrawRecord => {
    if (!isRecord(row) || typeof row.id !== 'string' || !row.id || ids.has(row.id) || typeof row.createdAt !== 'string' || !Number.isFinite(Date.parse(row.createdAt)) || typeof row.rules !== 'string' || row.rules.length > 2000 || typeof row.note !== 'string' || row.note.length > 500 || typeof row.favorite !== 'boolean' || !isRecord(row.result)) throw new Error('历史记录格式无效。')
    const mode = row.mode ?? 'eight'
    if (mode !== 'eight' && mode !== 'full' && mode !== 'single') throw new Error('历史模式无效。')
    const legacy = row.recruitCount === undefined
    const count = legacy ? 1 : row.recruitCount
    if (!isRecruitCount(count) || (mode === 'single' && count !== 1)) throw new Error('历史人数无效。')
    const keys = Object.keys(row.result)
    if (mode === 'single' ? keys.length !== 1 : keys.length !== 8) throw new Error('历史结果不完整。')
    const result: DrawRecord['result'] = {}
    for (const key of keys) {
      const p = PROFESSIONS.find(p => p === key)
      const snapshots = legacy ? [row.result[key]] : row.result[key]
      if (!p || !Array.isArray(snapshots) || snapshots.length !== count) throw new Error('历史干员数量无效。')
      const seen = new Set<string>()
      result[p] = snapshots.map((o: unknown) => {
        if (!isRecord(o) || typeof o.id !== 'string' || !o.id || seen.has(o.id) || typeof o.name !== 'string' || o.profession !== p || o.rarity !== 6) throw new Error('历史干员格式无效或重复。')
        seen.add(o.id)
        return { id: o.id, name: o.name, profession: p, rarity: 6 }
      })
    }
    if (row.theme !== undefined && !isISThemeId(row.theme)) throw new Error('历史主题无效。')
    if (mode === 'full' && (!isISThemeId(row.theme) || !getThemeOpening(row.theme).squads.some(o => o.id === row.squad) || !getThemeOpening(row.theme).recruits.some(o => o.id === row.recruit))) throw new Error('历史开局格式无效。')
    ids.add(row.id)
    return { id: row.id, createdAt: row.createdAt, rules: row.rules, note: row.note, favorite: row.favorite, result, recruitCount: count, ...(row.mode ? { mode } : {}), ...(isISThemeId(row.theme) ? { theme: row.theme } : {}), ...(mode === 'full' ? { squad: row.squad as string, recruit: row.recruit as string } : {}) }
  })
  if (rows.filter(r => r.favorite).length > FAVORITE_LIMIT) throw new Error('历史或收藏超过保存上限。')
  return trimHistory(rows)
}
export function captureRecord(config: LocalConfig, operators: Operator[], favorite = false): DrawRecord | null {
  const result: DrawRecord['result'] = {}
  const byId = new Map(operators.map(o => [o.id, o]))
  for (const p of PROFESSIONS) {
    const snapshots: Operator[] = []
    if (config.currentResult[p].length !== config.recruitCount) return null
    for (const id of config.currentResult[p]) {
      const operator = id ? byId.get(id) : undefined
      if (!operator || operator.profession !== p || operator.rarity !== 6 || snapshots.some(o => o.id === id)) return null
      snapshots.push({ ...operator })
    }
    result[p] = snapshots
  }
  return { id: crypto.randomUUID(), createdAt: new Date().toISOString(), result, recruitCount: config.recruitCount, favorite, note: '', rules: `每职业前${config.recruitCount}次六星招募依次使用对应结果，之后自由选择；仅启用的6★干员；${PROFESSIONS.map(p => `${p}候选${eligibleFor(p, operators, config.operatorStates).length}人${config.locks[p].some(Boolean) ? '（含锁定）' : ''}`).join('、')}` }
}
export function trimHistory(rows: DrawRecord[]): DrawRecord[] {
  let count = 0
  return rows.filter(row => row.favorite || ++count <= HISTORY_LIMIT)
}
export function restoreRecord(row: DrawRecord, config: LocalConfig, operators: Operator[]) {
  const result = blankResult(row.recruitCount), invalid: string[] = []
  for (const p of PROFESSIONS) for (const [i, snapshot] of (row.result[p] ?? []).entries()) {
    if (eligibleFor(p, operators, config.operatorStates).some(o => o.id === snapshot.id)) result[p][i] = snapshot.id
    else invalid.push(row.recruitCount === 1 ? p : `${p}第${i + 1}名`)
  }
  return { result, invalid }
}
export function captureModeRecord(config: LocalConfig, operators: Operator[], mode: RandomMode, favorite = false): DrawRecord | null {
  const session = getSession(config, mode)
  if (mode === 'full' && (!getThemeOpening(config.selectedTheme).squads.some(o => o.id === session.squad) || !getThemeOpening(config.selectedTheme).recruits.some(o => o.id === session.recruit))) return null
  if (mode === 'single') {
    const operator = operators.find(o => o.id === session.single)
    return operator ? { id: crypto.randomUUID(), createdAt: new Date().toISOString(), mode, recruitCount: 1, result: { [operator.profession]: [{ ...operator }] }, rules: '从全部已启用6★干员中抽取一名；重抽优先更换干员。', favorite, note: '' } : null
  }
  const row = captureRecord({ ...config, currentResult: session.result, locks: session.locks }, operators, favorite)
  const source = getThemeOpening(config.selectedTheme)
  return row ? { ...row, mode, ...(mode === 'full' ? { theme: config.selectedTheme ?? DEFAULT_THEME_ID, squad: session.squad!, recruit: session.recruit!, rules: `${row.rules}；主题规则核对${source.checkedAt}，PRTS修订${source.sourceRevision}` } : {}) } : null
}
export function recordText(row: DrawRecord): string {
  return [MODES.find(m => m.id === (row.mode ?? 'eight'))!.name + ' · 6★随机结果', row.theme ? IS_THEMES.find(t => t.id === row.theme)?.name : '', row.mode === 'full' ? `分队：${getThemeOpening(row.theme).squads.find(o => o.id === row.squad)?.name}\n招募组合：${getThemeOpening(row.theme).recruits.find(o => o.id === row.recruit)?.name}` : '', ...PROFESSIONS.flatMap(p => row.result[p] ? [`${p}：${row.result[p]!.map((o, i) => `${row.mode === 'single' ? '' : `第${i + 1}次六星招募 `}${o.name}`).join(' → ')}`] : []), `规则：${row.rules}`, row.note ? `备注：${row.note}` : ''].filter(Boolean).join('\n')
}
export function restoreModeRecord(row: DrawRecord, config: LocalConfig, operators: Operator[]) {
  const mode = row.mode ?? 'eight'
  const resized = mode === 'single' ? config : setRecruitCount(config, row.recruitCount)
  let next: LocalConfig = { ...resized, randomMode: mode, ...(mode === 'full' ? { selectedTheme: row.theme } : {}) }
  const session = getSession(next, mode)
  const { result, invalid } = restoreRecord(row, config, operators)
  const restored = { ...session, ...(mode === 'single' ? { single: Object.values(result).flat().find(Boolean) ?? null } : { result, locks: Object.fromEntries(PROFESSIONS.map(p => [p, result[p].map((id, i) => !!id && !!session.locks[p][i])])) as typeof session.locks }) }
  if (mode === 'full') {
    const settings = getOpeningSettings(config, row.theme)
    restored.squad = settings.excludedSquads.includes(row.squad!) ? null : row.squad!
    restored.recruit = settings.excludedRecruits.includes(row.recruit!) ? null : row.recruit!
    if (!restored.squad) invalid.push('分队')
    if (!restored.recruit) invalid.push('招募组合')
    restored.squadLocked = !!restored.squad && session.squadLocked
    restored.recruitLocked = !!restored.recruit && session.recruitLocked
  }
  restored.singleLocked = !!restored.single && session.singleLocked
  next = putSession(next, mode, restored)
  return { config: next, invalid }
}
