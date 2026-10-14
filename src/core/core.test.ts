import { describe, expect, it } from 'vitest'
import { PROFESSIONS, type Operator, type OperatorStateMap } from '../types'
import { blankLocks, blankResult, drawAll, redrawOne } from './randomizer'
import { defaultConfig, normalizeConfig } from './storage'
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
  it('按八职业生成对应的六星干员', () => {
    const result = drawAll(operators, states, base.settings, blankResult(), blankLocks(), first)
    expect(Object.keys(result)).toEqual([...PROFESSIONS])
    for (const profession of PROFESSIONS) expect(operators.find(o => o.id === result[profession])).toMatchObject({ profession, rarity: 6 })
  })
  it('跳过禁用干员', () => {
    const edited = { ...states, '0a': { owned: false, enabled: false } }
    expect(drawAll(operators, edited, base.settings, blankResult(), blankLocks(), first).先锋).toBe('0b')
  })
  it('仅拥有模式只用已拥有且启用的干员', () => {
    const edited = { ...states, '0b': { owned: true, enabled: true } }
    expect(drawAll(operators, edited, { ownedOnly: true }, blankResult(), blankLocks(), first).先锋).toBe('0b')
    expect(drawAll(operators, edited, { ownedOnly: false }, blankResult(), blankLocks(), first).先锋).toBe('0a')
  })
  it('单职业重抽只改变目标，并排除当前结果', () => {
    const current = drawAll(operators, states, base.settings, blankResult(), blankLocks(), first)
    const next = redrawOne('先锋', operators, states, base.settings, current, first)
    expect(next.先锋).toBe('0b')
    for (const profession of PROFESSIONS.slice(1)) expect(next[profession]).toBe(current[profession])
  })
  it('只有一个候选时保持该结果', () => {
    const edited = { ...states, '0b': { owned: false, enabled: false } }
    const current = { ...blankResult(), 先锋: '0a' }
    expect(redrawOne('先锋', operators, edited, base.settings, current, first).先锋).toBe('0a')
  })
  it('锁定职业在全局抽取时保留，空池会清空未锁定结果', () => {
    const current = drawAll(operators, states, base.settings, blankResult(), blankLocks(), first)
    const locks = { ...blankLocks(), 先锋: true }
    const next = drawAll(operators, states, base.settings, current, locks, last)
    expect(next.先锋).toBe('0a'); expect(next.近卫).toBe('1b')
    const empty = drawAll([], states, base.settings, current, blankLocks(), first)
    expect(PROFESSIONS.every(p => empty[p] === null)).toBe(true)
    expect(redrawOne('医疗', [], states, base.settings, current, first).医疗).toBeNull()
  })
})
describe('本地配置和导入', () => {
  it('新干员得到默认状态，旧干员按 id 保留', () => {
    const newer = [...operators, { id: 'new', name: '新干员', profession: '先锋' as const, rarity: 6 }]
    const stored = { ...base, operatorStates: { ...states, '0a': { owned: true, enabled: false } } }
    const normalized = normalizeConfig(stored, newer)
    expect(normalized.operatorStates['0a']).toEqual({ owned: true, enabled: false })
    expect(normalized.operatorStates.new).toEqual({ owned: false, enabled: true })
  })
  it('坏数据安全降级', () => {
    expect(normalizeConfig(null, operators)).toEqual(base)
    expect(normalizeConfig({ configVersion: 99 }, operators)).toEqual(base)
    expect(normalizeConfig({ configVersion: 1, operatorStates: { '0a': { owned: 'bad' } } }, operators).operatorStates['0a']).toEqual({ owned: false, enabled: true })
  })
  it('备份往返；无效导入不会得到新配置', () => {
    expect(parseImport(JSON.stringify(exportConfig(base)), operators)).toEqual(base)
    expect(() => parseImport('{', operators)).toThrow()
    expect(() => parseImport(JSON.stringify({ configVersion: 1, operatorStates: {}, settings: {} }), operators)).toThrow()
    expect(() => parseImport(JSON.stringify({ ...base, operatorStates: { x: { owned: 'yes', enabled: true } } }), operators)).toThrow()
  })
})
