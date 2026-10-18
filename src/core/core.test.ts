import { afterEach, describe, expect, it, vi } from 'vitest'
import { PROFESSIONS, type Operator, type OperatorStateMap } from '../types'
import { blankLocks, blankResult, drawAll, redrawOne, lockExistingResults } from './randomizer'
import { defaultConfig, loadConfig, normalizeConfig } from './storage'
import { parseImport, exportConfig } from './configTransfer'

const operators: Operator[] = PROFESSIONS.flatMap((profession, i) => [
  { id: `${i}a`, name: `${profession} A`, profession, rarity: 6 },
  { id: `${i}b`, name: `${profession} B`, profession, rarity: 6 },
  { id: `${i}five`, name: `${profession} 五星`, profession, rarity: 5 }
])
const base = defaultConfig(operators)
const states: OperatorStateMap = base.operatorStates
const first = () => 0
const last = (length: number) => length - 1

describe('抽取核心', () => {
  it('批量锁定已有结果，保留原锁定且空职业仍可生成，全部解锁后可换阵容', () => {
    const current = { ...blankResult(), 先锋: '0a' }
    const originalLocks = { ...blankLocks(), 医疗: true }
    const locks = lockExistingResults(current, originalLocks)
    expect(locks).toEqual({ ...originalLocks, 先锋: true })
    expect(originalLocks.先锋).toBe(false)
    const next = drawAll(operators, states, current, locks, last)
    expect(next.先锋).toBe('0a')
    expect(next.医疗).toBe('5b')
    expect(PROFESSIONS.every(p => next[p] !== null)).toBe(true)
    expect(redrawOne('先锋', operators, states, current, first).先锋).toBe('0b')
    const allLocked = lockExistingResults(next, locks)
    expect(drawAll(operators, states, next, allLocked, first)).toEqual(next)
    expect(drawAll(operators, states, next, blankLocks(), first).医疗).toBe('5a')
    expect(lockExistingResults(blankResult(), blankLocks())).toEqual(blankLocks())
  })
  it('按八职业生成对应的六星干员', () => {
    const result = drawAll(operators, states, blankResult(), blankLocks(), first)
    expect(Object.keys(result)).toEqual([...PROFESSIONS])
    for (const profession of PROFESSIONS) expect(operators.find(o => o.id === result[profession])).toMatchObject({ profession, rarity: 6 })
  })
  it('跳过禁用干员', () => {
    const edited = { ...states, '0a': { owned: false, enabled: false } }
    expect(drawAll(operators, edited, blankResult(), blankLocks(), first).先锋).toBe('0b')
  })
  it('仅依据启用状态，未拥有但启用的干员也可抽取', () => {
    const edited = { ...states, '0a': { owned: false, enabled: true }, '0b': { owned: true, enabled: false } }
    expect(drawAll(operators, edited, blankResult(), blankLocks(), first).先锋).toBe('0a')
    expect(redrawOne('先锋', operators, edited, blankResult(), first).先锋).toBe('0a')
  })
  it('单职业重抽只改变目标，并排除当前结果', () => {
    const current = drawAll(operators, states, blankResult(), blankLocks(), first)
    const next = redrawOne('先锋', operators, states, current, first)
    expect(next.先锋).toBe('0b')
    for (const profession of PROFESSIONS.slice(1)) expect(next[profession]).toBe(current[profession])
  })
  it('只有一个候选时保持该结果', () => {
    const edited = { ...states, '0b': { owned: false, enabled: false } }
    const current = { ...blankResult(), 先锋: '0a' }
    expect(redrawOne('先锋', operators, edited, current, first).先锋).toBe('0a')
  })
  it('锁定职业在全局抽取时保留，空池会清空未锁定结果', () => {
    const current = drawAll(operators, states, blankResult(), blankLocks(), first)
    const locks = { ...blankLocks(), 先锋: true }
    const next = drawAll(operators, states, current, locks, last)
    expect(next.先锋).toBe('0a'); expect(next.近卫).toBe('1b')
    const empty = drawAll([], states, current, blankLocks(), first)
    expect(PROFESSIONS.every(p => empty[p] === null)).toBe(true)
    expect(redrawOne('医疗', [], states, current, first).医疗).toBeNull()
  })
})
describe('本地配置和导入', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('打开页面清空旧结果，保留干员状态和锁定，锁定空结果仍可首次抽取', () => {
    const stored = { ...base, operatorStates: { ...states, '0a': { owned: true, enabled: false } }, locks: { ...base.locks, 先锋: true }, currentResult: drawAll(operators, states, blankResult(), blankLocks(), first) }
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(stored) })
    const loaded = loadConfig(operators)
    expect(loaded.warning).toBe(false)
    expect(loaded.config.currentResult).toEqual(blankResult())
    expect(loaded.config.operatorStates).toEqual(stored.operatorStates)
    expect(loaded.config.locks).toEqual(stored.locks)
    expect(drawAll(operators, loaded.config.operatorStates, loaded.config.currentResult, loaded.config.locks, first).先锋).toBe('0b')
    // Explicitly importing a backup still restores its lineup in the current page.
    expect(parseImport(JSON.stringify(stored), operators).currentResult).toEqual(stored.currentResult)
  })
  it('新干员得到默认状态，旧干员按 id 保留', () => {
    const newer = [...operators, { id: 'new', name: '新干员', profession: '先锋' as const, rarity: 6 }]
    const stored = { ...base, operatorStates: { ...states, '0a': { owned: true, enabled: false } } }
    const normalized = normalizeConfig(stored, newer)
    expect(normalized.operatorStates['0a']).toEqual({ owned: true, enabled: false })
    expect(normalized.operatorStates.new).toEqual({ owned: false, enabled: true })
  })
  it('旧 ownedOnly 配置和备份兼容读取，并移除该筛选条件', () => {
    const legacy = { ...base, settings: { ownedOnly: true }, operatorStates: { ...states, '0a': { owned: false, enabled: true }, '0b': { owned: true, enabled: false } }, locks: { ...base.locks, 近卫: true }, currentResult: { ...base.currentResult, 近卫: '1a' } }
    for (const config of [normalizeConfig(legacy, operators), parseImport(JSON.stringify(legacy), operators)]) {
      expect(config).not.toHaveProperty('settings')
      expect(config.operatorStates).toEqual(legacy.operatorStates)
      expect(config.locks).toEqual(legacy.locks)
      expect(config.currentResult).toEqual(legacy.currentResult)
      expect(drawAll(operators, config.operatorStates, config.currentResult, config.locks, first).先锋).toBe('0a')
      expect(exportConfig(config)).not.toHaveProperty('settings')
    }
  })
  it('坏数据安全降级', () => {
    expect(normalizeConfig(null, operators)).toEqual(base)
    expect(normalizeConfig({ configVersion: 99 }, operators)).toEqual(base)
    expect(normalizeConfig({ configVersion: 1, operatorStates: { '0a': { owned: 'bad' } } }, operators).operatorStates['0a']).toEqual({ owned: false, enabled: true })
  })
  it('备份往返；无效导入不会得到新配置', () => {
    expect(parseImport(JSON.stringify(exportConfig(base)), operators)).toEqual(base)
    expect(() => parseImport('{', operators)).toThrow()
    expect(() => parseImport(JSON.stringify({ configVersion: 1, operatorStates: [] }), operators)).toThrow()
    expect(() => parseImport(JSON.stringify({ ...base, operatorStates: { x: { owned: 'yes', enabled: true } } }), operators)).toThrow()
  })
})
