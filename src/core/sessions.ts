import { normalizeLineup, isRecord } from './lineup'
import type { LocalConfig, Operator, RandomMode, RandomSession, RecruitCount } from '../types'
import { DEFAULT_THEME_ID, IS_THEMES } from '../data/themes'
import { getThemeOpening } from '../data/openings'
import { blankLocks, blankResult, drawAll, lineupShortages, randomIndex, type PickIndex } from './randomizer'
import { getOpeningSettings } from './opening'
import { stateFor } from './operatorPool'

export const MODES = [{ id: 'full', name: '完全随机' }, { id: 'eight', name: '全职业随机' }, { id: 'single', name: '单干员随机' }] as const
export const sessionKey = (mode: RandomMode, theme = DEFAULT_THEME_ID) => mode === 'full' ? `full:${theme}` : mode
export const blankSession = (count: RecruitCount = 1): RandomSession => ({ result: blankResult(count), locks: blankLocks(count), squad: null, recruit: null, squadLocked: false, recruitLocked: false, single: null, singleLocked: false })
export function getSession(config: LocalConfig, mode: RandomMode): RandomSession {
  if (mode === 'eight') return { ...blankSession(config.recruitCount), result: config.currentResult, locks: config.locks }
  return config.sessions?.[sessionKey(mode, config.selectedTheme)] ?? blankSession(config.recruitCount)
}
export function putSession(config: LocalConfig, mode: RandomMode, session: RandomSession): LocalConfig {
  return mode === 'eight' ? { ...config, currentResult: session.result, locks: session.locks } : { ...config, sessions: { ...config.sessions, [sessionKey(mode, config.selectedTheme)]: session } }
}
export function drawSession(config: LocalConfig, mode: RandomMode, operators: Operator[], pick: PickIndex = randomIndex): { session: RandomSession; error?: string } {
  const current = getSession(config, mode)
  const settings = getOpeningSettings(config), data = getThemeOpening(config.selectedTheme)
  const squads = data.squads.filter(o => !settings.excludedSquads.includes(o.id))
  const recruits = data.recruits.filter(o => !settings.excludedRecruits.includes(o.id))
  const enabled = operators.filter(o => o.rarity === 6 && stateFor(o.id, config.operatorStates).enabled)
  if (mode === 'single') {
    if (current.singleLocked && current.single) return { session: current }
    if (!enabled.length) return { session: current, error: '没有已启用的6★干员，请调整干员库。' }
    const alternatives = enabled.filter(o => o.id !== current.single)
    const pool = alternatives.length ? alternatives : enabled
    return { session: { ...current, single: pool[pick(pool.length)].id } }
  }
  const missing = lineupShortages(operators, config.operatorStates, current.result, current.locks)
  if (mode === 'full') { if (!squads.length) missing.push('分队'); if (!recruits.length) missing.push('招募组合') }
  if (missing.length) return { session: current, error: `${missing.join('；')}，候选不足，请调整随机范围或干员库。本次未更改结果。` }
  const session = { ...current, result: drawAll(operators, config.operatorStates, current.result, current.locks, pick) }
  if (mode === 'full') {
    session.squad = current.squadLocked && squads.some(o => o.id === current.squad) ? current.squad : squads[pick(squads.length)].id
    session.recruit = current.recruitLocked && recruits.some(o => o.id === current.recruit) ? current.recruit : recruits[pick(recruits.length)].id
  }
  return { session }
}
export function normalizeSessions(value: unknown, operators: Operator[], count: RecruitCount = 1, legacy = false, strict = false): Record<string, RandomSession> {
  if (!isRecord(value)) { if (strict && value !== undefined) throw new Error('会话格式无效。'); return {} }
  const output: Record<string, RandomSession> = {}
  for (const key of [...IS_THEMES.map(t => `full:${t.id}`), 'single']) {
    const theme = IS_THEMES.find(t => key === `full:${t.id}`)?.id ?? DEFAULT_THEME_ID
    const options = getThemeOpening(theme)
    const raw = (value as Record<string, unknown>)[key]
    if (raw === undefined) continue
    if (!isRecord(raw)) { if (strict) throw new Error('会话格式无效。'); continue }
    const data = raw as Record<string, unknown>, session = { ...blankSession(count), ...normalizeLineup(data.result, data.locks, operators, count, legacy, strict) }
    if (strict) {
      for (const flag of ['squadLocked', 'recruitLocked', 'singleLocked']) if (data[flag] !== undefined && typeof data[flag] !== 'boolean') throw new Error('会话锁定格式无效。')
      for (const [field, choices] of [['squad', options.squads], ['recruit', options.recruits]] as const) if (data[field] !== undefined && data[field] !== null && !choices.some(o => o.id === data[field])) throw new Error('开局结果格式无效。')
      if (data.single !== undefined && data.single !== null && !operators.some(o => o.id === data.single && o.rarity === 6)) throw new Error('单干员结果格式无效。')
    }
    session.squad = options.squads.some(o => o.id === data.squad) ? data.squad as string : null
    session.recruit = options.recruits.some(o => o.id === data.recruit) ? data.recruit as string : null
    session.squadLocked = !!session.squad && data.squadLocked === true
    session.recruitLocked = !!session.recruit && data.recruitLocked === true
    session.single = operators.some(o => o.id === data.single && o.rarity === 6) ? data.single as string : null
    session.singleLocked = !!session.single && data.singleLocked === true
    output[key] = session
  }
  return output
}
