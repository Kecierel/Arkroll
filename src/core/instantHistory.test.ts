import { afterEach, describe, expect, it, vi } from 'vitest'
import database from '../data/operators.json'
import { type InstantRun, type Operator } from '../types'
import { blankInstantRun, confirmInstant, drawInstant, revokeInstantRecruit } from './instant'
import { captureInstantRecord, captureModeRecord, finishInstantRun, normalizeHistory, recordText, restoreModeRecord } from './history'
import { defaultConfig, loadConfig, saveConfig } from './storage'
import { exportConfig, parseImport } from './configTransfer'
import { drawSession, putSession } from './sessions'

const operators = database.operators as Operator[]
const chosen = operators.filter(operator => operator.profession === '先锋').slice(0, 5)
const other = operators.find(operator => operator.profession === '近卫')!
const config = () => defaultConfig(operators)
function completedRun(): InstantRun {
  return {
    ...blankInstantRun('phantom'), stage: 'journey', randomSquad: true, randomRecruit: true,
    squad: 'command', recruit: 'first', journeyProfessions: ['近卫'], journeyPending: other.id,
    recruits: chosen.map((operator, index) => ({
      operator: { ...operator }, stage: index === 0 ? 'opening' : 'journey',
      createdAt: new Date(Date.UTC(2026, 10, 6, 4, index)).toISOString(),
    })),
  }
}
function oldSingleRecord() {
  const c = config()
  return captureModeRecord(putSession(c, 'single', drawSession(c, 'single', operators, () => 0).session), operators, 'single')!
}
afterEach(() => vi.unstubAllGlobals())

describe('即时随机整局历史', () => {
  it('保存主题、可选分队组合及最终招募顺序，支持同职业超过三名', () => {
    const run = completedRun(), row = captureInstantRecord(run)!
    expect(row).toMatchObject({ mode: 'instant', theme: 'phantom', squad: 'command', recruit: 'first', favorite: false, note: '' })
    expect(row.recruits).toEqual(run.recruits)
    expect(row.recruits).toHaveLength(5)
    expect(normalizeHistory([row])).toEqual([row])
    expect(row).not.toHaveProperty('journeyPending')
    expect(row).not.toHaveProperty('recruitCount')
    expect(row).not.toHaveProperty('result')
  })
  it('快照独立，后续修改本局不改写历史', () => {
    const run = completedRun(), row = captureInstantRecord(run)!
    run.recruits[0].operator.name = 'changed'
    run.recruits.pop()
    run.squad = null
    expect(row.recruits).toHaveLength(5)
    expect(row.recruits[0].operator.name).toBe(chosen[0].name)
    expect(row.squad).toBe('command')
  })
  it('未确认、仅开局配置及全部撤回的局不生成历史', () => {
    expect(captureInstantRecord(blankInstantRun())).toBeNull()
    const pending = { ...blankInstantRun(), squad: 'command', recruit: 'first', openingPending: chosen[0].id }
    expect(captureInstantRecord(pending)).toBeNull()
    const revoked = completedRun()
    revoked.recruits = []
    expect(captureInstantRecord(revoked)).toBeNull()
    expect(finishInstantRun(config(), pending).history).toBeUndefined()
  })
  it('按撤回后的最终名单归档，保留开局与途中阶段', () => {
    const run = revokeInstantRecruit(completedRun(), chosen[2].id)
    const row = captureInstantRecord(run)!
    expect(row.recruits.map(recruit => recruit.operator.id)).toEqual(chosen.filter((_, index) => index !== 2).map(operator => operator.id))
    expect(row.recruits.map(recruit => recruit.stage)).toEqual(['opening', 'journey', 'journey', 'journey'])
    expect(row.recruits.some(recruit => recruit.operator.id === other.id)).toBe(false)
  })
  it('归档与重置为一次配置变更，重复结束空本局不会增加记录', () => {
    const run = completedRun(), before = { ...config(), instantRun: run, instantActive: true }
    const finished = finishInstantRun(before, run)
    expect(finished.history).toHaveLength(1)
    expect(finished.instantRun).toEqual({ ...blankInstantRun(), randomSquad: true, randomRecruit: true })
    expect(finished.instantActive).toBe(true)
    expect(before.instantRun.recruits).toHaveLength(5)
    expect(before.history).toBeUndefined()
    expect(finishInstantRun(finished, finished.instantRun!).history).toEqual(finished.history)
  })
  it('切换主题前保存原主题和开局，按新主题重置', () => {
    const run = completedRun(), finished = finishInstantRun({ ...config(), instantRun: run }, run, 'sami')
    expect(finished.instantRun?.theme).toBe('sami')
    expect(finished.history?.[0]).toMatchObject({ theme: 'phantom', squad: 'command', recruit: 'first' })
    expect(finished.selectedTheme).toBe(config().selectedTheme)
  })
  it('直接途中招募、可选开局缺失时也能生成整局记录', () => {
    const c = config(), run = { ...blankInstantRun('sami'), stage: 'journey' as const, journeyProfessions: ['先锋'] as InstantRun['journeyProfessions'] }
    const confirmed = confirmInstant(drawInstant(run, 'journey', operators, c, () => 0), 'journey', operators, c)
    expect(c.history).toBeUndefined()
    const row = captureInstantRecord(confirmed)!
    expect(row.recruits[0].stage).toBe('journey')
    expect(row.squad).toBeUndefined()
    expect(row.recruit).toBeUndefined()
    expect(normalizeHistory([row])).toEqual([row])
    expect(recordText(row)).toContain('未记录')
  })
  it('复制文本包含主题、分队组合、全局顺序、阶段、职业、时间和备注', () => {
    const row = { ...captureInstantRecord(completedRun())!, note: '整局备注' }
    const text = recordText(row)
    expect(text).toContain('即时随机 · 整局记录')
    expect(text).toContain('傀影与猩红孤钻')
    expect(text).toContain('指挥分队')
    expect(text).toContain('先手必胜')
    expect(text).toContain(`1. 开局 · 先锋 · ${chosen[0].name}`)
    expect(text).toContain(`5. 途中 · 先锋 · ${chosen[4].name}`)
    expect(text).toContain('整局备注')
    expect(text.indexOf(chosen[0].name)).toBeLessThan(text.indexOf(chosen[4].name))
  })
  it('共享30条未收藏与100条收藏上限，插入整局历史保留旧收藏', () => {
    const row = captureInstantRecord(completedRun())!
    const ordinary = Array.from({ length: 30 }, (_, index) => ({ ...oldSingleRecord(), id: `old-${index}` }))
    const favorites = Array.from({ length: 100 }, (_, index) => ({ ...row, id: `favorite-${index}`, favorite: true }))
    const c = { ...config(), history: [...ordinary, ...favorites] }
    const finished = finishInstantRun(c, completedRun())
    expect(finished.history).toHaveLength(130)
    expect(finished.history!.filter(record => record.favorite)).toHaveLength(100)
    expect(finished.history!.some(record => record.id === 'old-29')).toBe(false)
    expect(normalizeHistory(finished.history)).toEqual(finished.history)
  })
  it('混合历史与收藏备份往返，刷新保留已结束整局且不重复归档', () => {
    const run = completedRun()
    const c = finishInstantRun({ ...config(), history: [oldSingleRecord()], instantRun: run }, run)
    c.history![0].favorite = true
    c.history![0].note = '备份备注'
    expect(parseImport(JSON.stringify(exportConfig(c)), operators)).toEqual(c)
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(c) })
    expect(loadConfig(operators).config.history).toEqual(c.history)
    expect(finishInstantRun(c, c.instantRun!).history).toHaveLength(2)
  })
  it('名单变动与禁用不影响历史快照，历史查看不重新校验招募资格', () => {
    const c = { ...config(), history: [captureInstantRecord(completedRun())!] }
    for (const state of Object.values(c.operatorStates)) state.enabled = false
    expect(parseImport(JSON.stringify(c), []).history).toEqual(c.history)
    expect(() => restoreModeRecord(c.history[0], c, operators)).toThrow('整局历史')
  })
  it('保存失败时持久层保留原本局，可重试合并归档与重置', () => {
    const run = completedRun(), c = { ...config(), instantRun: run }
    let stored = JSON.stringify(c)
    let failing = true
    vi.stubGlobal('localStorage', {
      getItem: () => stored,
      setItem: (_key: string, value: string) => { if (failing) throw new Error('full'); stored = value },
    })
    const finished = finishInstantRun(c, run)
    expect(saveConfig(finished)).toBe(false)
    expect(loadConfig(operators).config.instantRun?.recruits).toHaveLength(5)
    expect(loadConfig(operators).config.history).toBeUndefined()
    failing = false
    expect(saveConfig(finished)).toBe(true)
    expect(loadConfig(operators).config.history).toHaveLength(1)
    expect(loadConfig(operators).config.instantRun?.recruits).toEqual([])
  })
  it.each([
    { theme: 'unknown' }, { squad: 'unknown' }, { recruit: 'unknown' },
    { recruits: [] }, { recruits: null }, { recruits: [{}] },
    { recruits: [{ ...completedRun().recruits[0], createdAt: 'bad' }] },
    { recruits: [{ ...completedRun().recruits[0], operator: { ...chosen[0], rarity: 5 } }] },
    { recruits: [completedRun().recruits[0], completedRun().recruits[0]] },
    { recruits: [completedRun().recruits[1], completedRun().recruits[0]] },
  ])('非法整局历史导入被拒绝 %j', patch => {
    const row = { ...captureInstantRecord(completedRun())!, ...patch }
    expect(() => parseImport(JSON.stringify({ ...config(), history: [row] }), operators)).toThrow()
  })
})
