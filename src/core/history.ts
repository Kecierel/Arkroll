import { PROFESSIONS, type DrawRecord, type InstantDrawRecord, type InstantRun, type RandomDrawRecord, type LocalConfig, type Operator, type RandomMode } from '../types'
import { DEFAULT_THEME_ID, IS_THEMES, isISThemeId, type ISThemeId } from '../data/themes'
import { getThemeOpening } from '../data/openings'
import { getOpeningSettings } from './opening'
import { getSession, MODES, putSession } from './sessions'
import { blankResult } from './randomizer'
import { eligibleFor } from './operatorPool'
import { isRecord, isRecruitCount, setRecruitCount } from './lineup'
import { normalizeInstantRecruits, resetInstantRun } from './instant'

export const HISTORY_LIMIT = 30
export const FAVORITE_LIMIT = 100
export function normalizeHistory(value: unknown): DrawRecord[] {
  if (!Array.isArray(value)) throw new Error('历史记录格式无效。')
  const ids = new Set<string>()
  const rows = value.map((row: unknown): DrawRecord => {
    if (!isRecord(row) || typeof row.id !== 'string' || !row.id || ids.has(row.id) || typeof row.createdAt !== 'string' || !Number.isFinite(Date.parse(row.createdAt)) || typeof row.rules !== 'string' || row.rules.length > 2000 || typeof row.note !== 'string' || row.note.length > 500 || typeof row.favorite !== 'boolean') throw new Error('历史记录格式无效。')
    if (row.mode === 'instant') {
      if (!isISThemeId(row.theme)) throw new Error('历史主题无效。')
      const opening = getThemeOpening(row.theme)
      if (row.squad !== undefined && !opening.squads.some(option => option.id === row.squad)) throw new Error('历史分队无效。')
      if (row.recruit !== undefined && !opening.recruits.some(option => option.id === row.recruit)) throw new Error('历史招募组合无效。')
      const recruits = normalizeInstantRecruits(row.recruits, true)
      if (!recruits.length) throw new Error('整局历史至少需要一名已确认招募的干员。')
      ids.add(row.id)
      return {
        id: row.id, createdAt: row.createdAt, rules: row.rules, favorite: row.favorite, note: row.note,
        mode: 'instant', theme: row.theme, recruits,
        ...(row.squad !== undefined ? { squad: row.squad as string } : {}),
        ...(row.recruit !== undefined ? { recruit: row.recruit as string } : {}),
      }
    }
    if (!isRecord(row.result)) throw new Error('历史记录格式无效。')
    const mode = row.mode ?? 'eight'
    if (mode !== 'eight' && mode !== 'full' && mode !== 'single') throw new Error('历史模式无效。')
    const legacy = row.recruitCount === undefined
    const count = legacy ? 1 : row.recruitCount
    if (!isRecruitCount(count) || (mode === 'single' && count !== 1)) throw new Error('历史人数无效。')
    const keys = Object.keys(row.result)
    if (mode === 'single' ? keys.length !== 1 : keys.length !== 8) throw new Error('历史结果不完整。')
    const result: RandomDrawRecord['result'] = {}
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
export function captureRecord(config: LocalConfig, operators: Operator[], favorite = false): RandomDrawRecord | null {
  const result: RandomDrawRecord['result'] = {}
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
export function restoreRecord(row: RandomDrawRecord, config: LocalConfig, operators: Operator[]) {
  const result = blankResult(row.recruitCount), invalid: string[] = []
  for (const p of PROFESSIONS) for (const [i, snapshot] of (row.result[p] ?? []).entries()) {
    if (eligibleFor(p, operators, config.operatorStates).some(o => o.id === snapshot.id)) result[p][i] = snapshot.id
    else invalid.push(row.recruitCount === 1 ? p : `${p}第${i + 1}名`)
  }
  return { result, invalid }
}
export function captureModeRecord(config: LocalConfig, operators: Operator[], mode: RandomMode, favorite = false): RandomDrawRecord | null {
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
export function captureInstantRecord(run: InstantRun): InstantDrawRecord | null {
  if (!run.recruits.length) return null
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    mode: 'instant',
    theme: run.theme,
    ...(run.squad ? { squad: run.squad } : {}),
    ...(run.recruit ? { recruit: run.recruit } : {}),
    recruits: run.recruits.map(row => ({ ...row, operator: { ...row.operator } })),
    rules: '所选职业已启用6★干员等概率抽取。确认招募后本局排除，结束时保存撤回调整后的最终确认名单。',
    favorite: false,
    note: '',
  }
}

/** Archive the final confirmed list and reset the run in one config update. */
export function finishInstantRun(config: LocalConfig, run: InstantRun, theme: ISThemeId = run.theme): LocalConfig {
  const record = captureInstantRecord(run)
  return {
    ...config,
    instantRun: resetInstantRun(run, theme),
    ...(record ? { history: trimHistory([record, ...(config.history ?? [])]) } : {}),
  }
}

export function recordText(row: DrawRecord): string {
  if (row.mode === 'instant') {
    const opening = getThemeOpening(row.theme)
    return [
      '即时随机 · 整局记录',
      IS_THEMES.find(theme => theme.id === row.theme)!.name,
      `分队 · ${opening.squads.find(option => option.id === row.squad)?.name ?? '未记录'}`,
      `招募组合 · ${opening.recruits.find(option => option.id === row.recruit)?.name ?? '未记录'}`,
      ...row.recruits.map((recruit, index) => `${index + 1}. ${recruit.stage === 'opening' ? '开局' : '途中'} · ${recruit.operator.profession} · ${recruit.operator.name} · ${new Date(recruit.createdAt).toLocaleString('zh-CN')}`),
      `规则 · ${row.rules}`,
      row.note ? `备注 · ${row.note}` : '',
    ].filter(Boolean).join('\n')
  }
  return [MODES.find(m => m.id === (row.mode ?? 'eight'))!.name + ' · 6★随机结果', row.theme ? IS_THEMES.find(t => t.id === row.theme)?.name : '', row.mode === 'full' ? `分队：${getThemeOpening(row.theme).squads.find(o => o.id === row.squad)?.name}\n招募组合：${getThemeOpening(row.theme).recruits.find(o => o.id === row.recruit)?.name}` : '', ...PROFESSIONS.flatMap(p => row.result[p] ? [`${p}：${row.result[p]!.map((o, i) => `${row.mode === 'single' ? '' : `第${i + 1}次六星招募 `}${o.name}`).join(' → ')}`] : []), `规则：${row.rules}`, row.note ? `备注：${row.note}` : ''].filter(Boolean).join('\n')
}
export function restoreModeRecord(row: DrawRecord, config: LocalConfig, operators: Operator[]) {
  if (row.mode === 'instant') throw new Error('即时随机整局历史支持查看、收藏和复制。')
  const mode = row.mode ?? 'eight'
  const resized = mode === 'single' ? config : setRecruitCount(config, row.recruitCount)
  let next: LocalConfig = { ...resized, instantActive: false, randomMode: mode, ...(mode === 'full' ? { selectedTheme: row.theme } : {}) }
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
