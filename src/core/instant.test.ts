import { afterEach, describe, expect, it, vi } from 'vitest'
import { PROFESSIONS, type InstantRun, type Operator } from '../types'
import { blankInstantRun, confirmInstant, drawInstant, drawInstantOpening, instantHasProgress, instantPool, normalizeInstantRun, resetInstantRun, revokeInstantRecruit, selectInstantProfession } from './instant'
import { defaultConfig, loadConfig, normalizeConfig, saveConfig } from './storage'
import { exportConfig, parseImport } from './configTransfer'
import { getThemeOpening } from '../data/openings'
import { IS_THEMES } from '../data/themes'
import { setOpeningSettings } from './opening'
import { drawSession, putSession } from './sessions'
import { captureModeRecord, restoreModeRecord } from './history'

const operators: Operator[] = [
  { id: 'v1', name: '先锋甲', profession: '先锋', rarity: 6 },
  { id: 'v2', name: '先锋乙', profession: '先锋', rarity: 6 },
  { id: 'g1', name: '近卫甲', profession: '近卫', rarity: 6 },
  { id: 'five', name: '五星', profession: '先锋', rarity: 5 },
]
const first = () => 0
const config = () => defaultConfig(operators)
const selectedRun = (): InstantRun => ({ ...blankInstantRun(), openingProfessions: ['先锋', '近卫'], journeyProfessions: ['先锋', '近卫'] })
const recruitedRun = () => confirmInstant(drawInstant(selectedRun(), 'opening', operators, config(), first), 'opening', operators, config())
afterEach(() => vi.unstubAllGlobals())

describe('即时随机抽取和招募确认', () => {
  it('默认开关关闭、职业未选中、无记录', () => {
    const run = blankInstantRun('sami')
    expect(run.theme).toBe('sami')
    expect(run.randomSquad).toBe(false)
    expect(run.randomRecruit).toBe(false)
    expect(run.openingProfessions).toEqual([])
    expect(run.journeyProfessions).toEqual([])
    expect(instantHasProgress(run)).toBe(false)
  })
  it('按干员合并候选，职业人数不等时每个随机下标对应一名干员', () => {
    const run = selectedRun(), c = config()
    const lengths: number[] = []
    const results = [0, 1, 2].map(index => drawInstant(run, 'opening', operators, c, length => { lengths.push(length); return index }).openingPending)
    expect(lengths).toEqual([3, 3, 3])
    expect(results).toEqual(['v1', 'v2', 'g1'])
  })
  it('只用启用六星，未拥有但启用仍参与', () => {
    const c = config(); c.operatorStates.v2.enabled = false
    expect(instantPool(selectedRun(), 'opening', operators, c).map(o => o.id)).toEqual(['v1', 'g1'])
    expect(c.operatorStates.v1.owned).toBe(false)
  })
  it('支持选择1至8个职业，改变选择只清空该阶段候选', () => {
    let run: InstantRun = { ...blankInstantRun(), journeyPending: 'v1' }
    for (const profession of PROFESSIONS) run = selectInstantProfession(run, 'opening', profession)
    expect(run.openingProfessions).toHaveLength(8)
    run = { ...run, openingPending: 'v1' }
    run = selectInstantProfession(run, 'opening', '先锋')
    expect(run.openingPending).toBeNull()
    expect(run.journeyPending).toBe('v1')
    expect(run.openingProfessions).toHaveLength(7)
  })
  it('不选职业、全部禁用与候选耗尽时拒绝抽取且不消耗随机数', () => {
    const pick = vi.fn(first), c = config()
    expect(() => drawInstant(blankInstantRun(), 'opening', operators, c, pick)).toThrow('至少一个职业')
    for (const state of Object.values(c.operatorStates)) state.enabled = false
    expect(() => drawInstant(selectedRun(), 'opening', operators, c, pick)).toThrow('没有可招募')
    const run = recruitedRun()
    run.journeyProfessions = ['近卫']
    c.operatorStates.g1.enabled = false
    expect(() => drawInstant(run, 'journey', operators, c, pick)).toThrow()
    expect(pick).not.toHaveBeenCalled()
  })
  it('部分选中职业无候选仍从其他所选职业抽取', () => {
    const run = { ...selectedRun(), journeyProfessions: ['医疗', '近卫'] as InstantRun['journeyProfessions'] }
    expect(drawInstant(run, 'journey', operators, config(), first).journeyPending).toBe('g1')
  })
  it('抽取不加入排除，重抽仍可抽中自己，放弃后仍可抽取', () => {
    const c = config(), run = drawInstant(selectedRun(), 'opening', operators, c, first)
    expect(run.recruits).toEqual([])
    expect(instantPool(run, 'opening', operators, c)).toHaveLength(3)
    expect(drawInstant(run, 'opening', operators, c, first).openingPending).toBe('v1')
    expect(drawInstant({ ...run, openingPending: null }, 'opening', operators, c, first).openingPending).toBe('v1')
  })
  it('开局确认进入途中、清除待确认、开局和途中共用排除名单', () => {
    const run = recruitedRun(), c = config()
    expect(run.stage).toBe('journey')
    expect(run.recruits[0]).toMatchObject({ operator: operators[0], stage: 'opening' })
    expect(run.openingPending).toBeNull()
    expect(run.journeyPending).toBeNull()
    expect(run.openingProfessions).toEqual([])
    expect(run.journeyProfessions).toEqual([])
    const selected = { ...run, journeyProfessions: selectedRun().journeyProfessions }
    expect(instantPool(selected, 'journey', operators, c).map(o => o.id)).toEqual(['v2', 'g1'])
    const next = confirmInstant(drawInstant(selected, 'journey', operators, c, first), 'journey', operators, c)
    expect(next.recruits.map(row => row.operator.id)).toEqual(['v1', 'v2'])
  })
  it('可以直接途中抽取和确认，确认后禁止回到开局抽取或确认', () => {
    const c = config()
    const run = confirmInstant(drawInstant(selectedRun(), 'journey', operators, c, first), 'journey', operators, c)
    expect(run.recruits[0].stage).toBe('journey')
    expect(() => drawInstant(run, 'opening', operators, c)).toThrow('结束本局')
    expect(() => confirmInstant(run, 'opening', operators, c)).toThrow('结束本局')
    expect(() => drawInstantOpening(run, 'squad', c)).toThrow('结束本局')
  })
  it('重复确认及注入已招募候选被拒绝', () => {
    const c = config(), run = recruitedRun()
    expect(() => confirmInstant(run, 'journey', operators, c)).toThrow()
    expect(() => confirmInstant({ ...run, journeyPending: 'v1' }, 'journey', operators, c)).toThrow()
    expect(run.recruits).toHaveLength(1)
  })
  it('确认前禁用或移出当前职业会拒绝，旧记录保持', () => {
    const c = config(), run = drawInstant(selectedRun(), 'journey', operators, c, first)
    c.operatorStates.v1.enabled = false
    expect(() => confirmInstant(run, 'journey', operators, c)).toThrow('已失效')
    expect(() => confirmInstant({ ...run, journeyProfessions: ['近卫'] }, 'journey', operators, config())).toThrow()
    const recorded = recruitedRun()
    expect(normalizeInstantRun(recorded, operators).recruits).toEqual(recorded.recruits)
  })
  it('单候选可重抽，确认后耗尽时保留进度', () => {
    const c = config(), run = { ...selectedRun(), journeyProfessions: ['近卫'] as InstantRun['journeyProfessions'] }
    const drawn = drawInstant(run, 'journey', operators, c, first)
    expect(drawInstant(drawn, 'journey', operators, c, first).journeyPending).toBe('g1')
    const recorded = confirmInstant(drawn, 'journey', operators, c)
    expect(() => drawInstant({ ...recorded, journeyProfessions: ['近卫'] }, 'journey', operators, c)).toThrow('没有可招募')
    expect(recorded.recruits).toHaveLength(1)
  })
  it.each(['opening', 'journey'] as const)('确认%s后两阶段职业恢复未选择，下一次必须重新选择', stage => {
    const run = selectedRun()
    const confirmed = confirmInstant(drawInstant(run, stage, operators, config(), first), stage, operators, config())
    expect(confirmed.openingProfessions).toEqual([])
    expect(confirmed.journeyProfessions).toEqual([])
    expect(() => drawInstant(confirmed, 'journey', operators, config(), first)).toThrow('至少一个职业')
    expect(run.openingProfessions).toEqual(['先锋', '近卫'])
  })
  it('撤回任意中间条目后解除排除，保留其他顺序与当前待确认结果', () => {
    const c = config()
    const opening = recruitedRun()
    const second = confirmInstant(drawInstant({ ...opening, journeyProfessions: ['先锋'] }, 'journey', operators, c, first), 'journey', operators, c)
    const third = confirmInstant(drawInstant({ ...second, journeyProfessions: ['近卫'] }, 'journey', operators, c, first), 'journey', operators, c)
    const pending = { ...third, journeyProfessions: ['近卫'] as InstantRun['journeyProfessions'], journeyPending: null }
    const revoked = revokeInstantRecruit(pending, 'v2')
    expect(revoked.recruits.map(row => row.operator.id)).toEqual(['v1', 'g1'])
    expect(revoked.journeyProfessions).toEqual(pending.journeyProfessions)
    expect(revoked.journeyPending).toBe(pending.journeyPending)
    expect(instantPool({ ...revoked, journeyProfessions: ['先锋'] }, 'journey', operators, c).map(o => o.id)).toEqual(['v2'])
    expect(third.recruits).toHaveLength(3)
    expect(normalizeInstantRun(revoked, operators, undefined, true)).toEqual(revoked)
  })
  it('撤回开局记录保留途中和候选，JSON与刷新保持撤回后的排除集合', () => {
    const c = config()
    const run = confirmInstant(drawInstant({ ...recruitedRun(), journeyProfessions: ['近卫'] }, 'journey', operators, c, first), 'journey', operators, c)
    const pending = drawInstant({ ...run, journeyProfessions: ['先锋'] }, 'journey', operators, c, first)
    const revoked = revokeInstantRecruit(pending, 'v1')
    expect(revoked.recruits.map(row => row.operator.id)).toEqual(['g1'])
    expect(revoked.journeyPending).toBe('v2')
    const saved = { ...c, instantRun: revoked }
    expect(parseImport(JSON.stringify(exportConfig(saved)), operators).instantRun).toEqual(revoked)
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(saved) })
    expect(loadConfig(operators).config.instantRun).toEqual(revoked)
    expect(instantPool(revoked, 'journey', operators, c).map(o => o.id)).toEqual(['v1', 'v2'])
  })
  it('撤回唯一记录和重复撤回安全，干员仍依据当前启用状态参与', () => {
    const c = config()
    const revoked = revokeInstantRecruit(recruitedRun(), 'v1')
    expect(revoked.recruits).toEqual([])
    expect(instantHasProgress(revoked)).toBe(false)
    expect(revokeInstantRecruit(revoked, 'v1')).toEqual(revoked)
    expect(revokeInstantRecruit(revoked, 'unknown')).toEqual(revoked)
    const selected = { ...revoked, journeyProfessions: ['先锋'] as InstantRun['journeyProfessions'] }
    c.operatorStates.v1.enabled = false
    expect(instantPool(selected, 'journey', operators, c).map(o => o.id)).toEqual(['v2'])
    c.operatorStates.v1.enabled = true
    expect(instantPool(selected, 'journey', operators, c).map(o => o.id)).toEqual(['v1', 'v2'])
  })
  it('单纯选择职业不计为已开局，抽到开局配置或候选后才有本局进度', () => {
    expect(instantHasProgress(selectedRun())).toBe(false)
    expect(instantHasProgress(drawInstant(selectedRun(), 'opening', operators, config(), first))).toBe(true)
    expect(instantHasProgress({ ...selectedRun(), squad: 'command' })).toBe(true)
    expect(instantHasProgress({ ...selectedRun(), recruit: 'first' })).toBe(true)
  })
  it('新局保留主题和开关，清空选择、候选和记录', () => {
    const run = { ...recruitedRun(), randomSquad: true, randomRecruit: true, squad: 'command', recruit: 'first' }
    expect(instantHasProgress(run)).toBe(true)
    expect(resetInstantRun(run, 'sami')).toEqual({ ...blankInstantRun('sami'), randomSquad: true, randomRecruit: true })
    expect(run.recruits).toHaveLength(1)
  })
})

describe('开局配置和本局持久化', () => {
  it('六主题各自抽取分队和组合，彼此独立，遵守排除范围', () => {
    for (const theme of IS_THEMES) {
      const data = getThemeOpening(theme.id)
      const c = setOpeningSettings(config(), theme.id, { excludedSquads: [data.squads[0].id], excludedRecruits: [data.recruits[0].id] })
      const run = { ...blankInstantRun(theme.id), randomSquad: true, randomRecruit: true }
      const drawn = drawInstantOpening(run, 'squad', c, first)
      expect(drawn.squad).toBe(data.squads[1].id)
      expect(drawn.recruit).toBeNull()
      expect(drawInstantOpening(drawn, 'recruit', c, first).recruit).toBe(data.recruits[1].id)
    }
  })
  it('修改范围及刷新时清除已排除的即时分队和组合，保留已招募记录', () => {
    const c = { ...config(), instantRun: { ...recruitedRun(), randomSquad: true, randomRecruit: true, squad: 'command', recruit: 'first' } }
    const next = setOpeningSettings(c, 'phantom', { excludedSquads: ['command'], excludedRecruits: ['first'] })
    expect(next.instantRun?.squad).toBeNull()
    expect(next.instantRun?.recruit).toBeNull()
    expect(next.instantRun?.recruits).toEqual(c.instantRun.recruits)
    const normalized = normalizeConfig({ ...c, themeOpenings: next.themeOpenings }, operators)
    expect(normalized.instantRun?.squad).toBeNull()
    expect(setOpeningSettings(c, 'sami', { excludedSquads: ['command'], excludedRecruits: [] }).instantRun).toEqual(c.instantRun)
  })
  it('开关关闭或项目全排除时拒绝，单候选仍可重抽', () => {
    const c = config(), data = getThemeOpening()
    expect(() => drawInstantOpening(blankInstantRun(), 'squad', c)).toThrow('开关')
    const run = { ...blankInstantRun(), randomSquad: true }
    const single = setOpeningSettings(c, run.theme, { excludedSquads: data.squads.slice(1).map(o => o.id), excludedRecruits: [] })
    const drawn = drawInstantOpening(run, 'squad', single, first)
    expect(drawInstantOpening(drawn, 'squad', single, first).squad).toBe(data.squads[0].id)
    const empty = setOpeningSettings(c, run.theme, { excludedSquads: data.squads.map(o => o.id), excludedRecruits: [] })
    expect(() => drawInstantOpening(drawn, 'squad', empty)).toThrow('没有可用候选')
  })
  it('刷新保留即时本局和入口，原模式结果依旧清空', () => {
    let c = config()
    c = putSession(c, 'single', drawSession(c, 'single', operators, first).session)
    c.instantRun = recruitedRun(); c.instantActive = true
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(c) })
    const loaded = loadConfig(operators).config
    expect(loaded.instantRun).toEqual(c.instantRun)
    expect(loaded.instantActive).toBe(true)
    expect(loaded.sessions).toBeUndefined()
    expect(loaded.currentResult.先锋).toEqual([null])
  })
  it('待确认结果、职业与开关随JSON备份往返且旧备份默认无本局', () => {
    const c = { ...config(), instantRun: drawInstant(selectedRun(), 'journey', operators, config(), first), instantActive: true }
    expect(parseImport(JSON.stringify(exportConfig(c)), operators)).toEqual(c)
    expect(parseImport(JSON.stringify(exportConfig(config())), operators).instantRun).toBeUndefined()
  })
  it('确认记录包含干员快照，资料移除后仍保留本局记录', () => {
    const run = recruitedRun()
    expect(normalizeInstantRun(run, [], undefined, true).recruits).toEqual(run.recruits)
  })
  it('旧历史恢复退出即时入口但保留本局', () => {
    const c = putSession(config(), 'single', drawSession(config(), 'single', operators, first).session)
    c.instantRun = recruitedRun(); c.instantActive = true
    const row = captureModeRecord(c, operators, 'single')!
    const restored = restoreModeRecord(row, c, operators).config
    expect(restored.instantActive).toBe(false)
    expect(restored.instantRun).toEqual(c.instantRun)
  })
  it.each([
    { theme: 'unknown' }, { stage: 'unknown' }, { randomSquad: 'yes' }, { squad: 'unknown' },
    { openingProfessions: ['先锋', '先锋'] }, { journeyProfessions: ['unknown'] },
    { journeyPending: 'unknown' }, { recruits: [{}] }, { recruits: 'bad' },
    { recruits: [...recruitedRun().recruits, ...recruitedRun().recruits] },
    { recruits: [{ ...recruitedRun().recruits[0], createdAt: 'bad' }] },
  ])('非法即时备份被拒绝 %j', patch => {
    const c = { ...config(), instantRun: { ...selectedRun(), ...patch } }
    expect(() => parseImport(JSON.stringify(c), operators)).toThrow('即时随机')
  })
  it('本地损坏数据安全降级，合法部分可保留', () => {
    expect(normalizeInstantRun(null, operators)).toEqual(blankInstantRun())
    expect(normalizeInstantRun({ ...selectedRun(), recruits: [{}], journeyPending: 'unknown' }, operators).recruits).toEqual([])
    expect(normalizeConfig({ ...config(), instantRun: 'bad' }, operators).instantRun).toEqual(blankInstantRun())
  })
  it('本地保存失败可报告，确认计算保持不可变', () => {
    const run = drawInstant(selectedRun(), 'journey', operators, config(), first)
    const snapshot = structuredClone(run)
    vi.stubGlobal('localStorage', { setItem: () => { throw new Error('full') } })
    const confirmed = confirmInstant(run, 'journey', operators, config())
    expect(saveConfig({ ...config(), instantRun: confirmed })).toBe(false)
    expect(run).toEqual(snapshot)
  })
})
