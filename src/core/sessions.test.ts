import { afterEach, describe, expect, it, vi } from 'vitest'
import database from '../data/operators.json'
import { PROFESSIONS, type Operator } from '../types'
import { defaultConfig, loadConfig, saveConfig } from './storage'
import { blankSession, drawSession, getSession, putSession } from './sessions'
import { captureModeRecord, normalizeHistory, recordText, restoreModeRecord } from './history'
import { PHANTOM_SQUADS } from '../data/openings'
import { parseImport, exportConfig } from './configTransfer'

const operators = database.operators as Operator[], first = () => 0
const fullConfig = () => ({ ...defaultConfig(operators), randomMode: 'full' as const })
function drawnFull() { const config = fullConfig(); return putSession(config, 'full', drawSession(config, 'full', operators, first).session) }
afterEach(() => vi.unstubAllGlobals())

describe('三种随机模式', () => {
  it('完全随机一次生成十项且八职业资格正确', () => {
    const config = drawnFull(), session = getSession(config, 'full')
    expect(session.squad).toBe('command'); expect(session.recruit).toBe('first')
    for (const p of PROFESSIONS) expect(operators.find(o => o.id === session.result[p])).toMatchObject({ profession: p, rarity: 6 })
    expect(captureModeRecord(config, operators, 'full')).not.toBeNull()
  })
  it('缺失任意候选时完全随机保持整套结果，包括分队与组合', () => {
    const config = drawnFull(), before = structuredClone(getSession(config, 'full'))
    config.phantomOpening = { excludedSquads: PHANTOM_SQUADS.map(o => o.id), excludedRecruits: [] }
    expect(drawSession(config, 'full', operators).error).toContain('分队')
    expect(drawSession(config, 'full', operators).session).toEqual(before)
    config.phantomOpening.excludedSquads = []
    for (const o of operators.filter(o => o.profession === '先锋')) config.operatorStates[o.id].enabled = false
    expect(drawSession(config, 'full', operators).error).toContain('先锋')
    expect(drawSession(config, 'full', operators).session).toEqual(before)
  })
  it('全局随机尊重十项锁定，空项仍能生成', () => {
    let config = drawnFull(), session = getSession(config, 'full')
    session = { ...session, locks: Object.fromEntries(PROFESSIONS.map(p => [p, true])) as typeof session.locks, squadLocked: true, recruitLocked: true }
    config = putSession(config, 'full', session) as typeof config
    expect(drawSession(config, 'full', operators, length => length - 1).session).toEqual(session)
    config = putSession(config, 'full', { ...session, result: { ...session.result, 先锋: null }, squad: null }) as typeof config
    const next = drawSession(config, 'full', operators, first).session
    expect(next.result.先锋).not.toBeNull(); expect(next.squad).toBe('command')
  })
  it('模式和主题隔离，切回可恢复，每个主题支持完全随机和基础干员模式', () => {
    let config = drawnFull(), full = getSession(config, 'full')
    config = putSession(config, 'single', drawSession(config, 'single', operators, first).session) as typeof config
    expect(getSession(config, 'full')).toEqual(full)
    expect(getSession(config, 'eight').result.先锋).toBeNull()
    const other = { ...config, selectedTheme: 'mizuki' as const }
    expect(getSession(other, 'full')).toEqual(blankSession())
    expect(drawSession(other, 'full', operators).error).toBeUndefined()
    expect(drawSession(other, 'eight', operators).error).toBeUndefined()
    expect(drawSession(other, 'single', operators).error).toBeUndefined()
  })
  it('单干员只从已启用六星中抽取，重抽更换，锁定保留，单候选稳定', () => {
    let config = fullConfig()
    for (const o of operators) config.operatorStates[o.id].enabled = false
    config.operatorStates[operators[0].id].enabled = true
    config.operatorStates[operators[1].id].enabled = true
    config = putSession(config, 'single', drawSession(config, 'single', operators, first).session) as typeof config
    expect(getSession(config, 'single').single).toBe(operators[0].id)
    expect(drawSession(config, 'single', operators, first).session.single).toBe(operators[1].id)
    config = putSession(config, 'single', { ...getSession(config, 'single'), singleLocked: true }) as typeof config
    expect(drawSession(config, 'single', operators, first).session.single).toBe(operators[0].id)
    config.operatorStates[operators[1].id].enabled = false
    config = putSession(config, 'single', { ...getSession(config, 'single'), singleLocked: false }) as typeof config
    expect(drawSession(config, 'single', operators, first).session.single).toBe(operators[0].id)
    config.operatorStates[operators[0].id].enabled = false
    expect(drawSession(config, 'single', operators).error).toBeTruthy()
  })
  it('新旧历史与备份往返，复制内容完整，错误模式数据被拒绝', () => {
    let config = drawnFull()
    const full = captureModeRecord(config, operators, 'full')!
    config = putSession(config, 'single', drawSession(config, 'single', operators, first).session) as typeof config
    const single = captureModeRecord(config, operators, 'single')!
    expect(Object.keys(single.result)).toHaveLength(1)
    expect(recordText(full)).toContain('分队：指挥分队')
    expect(recordText(full)).toContain('招募组合：先手必胜')
    expect(recordText(single)).toContain('单干员随机')
    config.history = [full, single]
    expect(parseImport(JSON.stringify(exportConfig(config)), operators)).toEqual(config)
    expect(() => normalizeHistory([{ ...full, squad: 'unknown' }])).toThrow()
    expect(() => normalizeHistory([{ ...single, mode: 'full' }])).toThrow()
  })
  it('恢复会切换模式和主题，排除项与禁用干员留空，不修改候选设置', () => {
    const config = drawnFull(), row = captureModeRecord(config, operators, 'full')!
    config.selectedTheme = 'mizuki'
    config.phantomOpening = { excludedSquads: ['command'], excludedRecruits: ['first'] }
    config.operatorStates[row.result.先锋!.id].enabled = false
    const restored = restoreModeRecord(row, config, operators)
    expect(restored.config.selectedTheme).toBe('phantom'); expect(restored.config.randomMode).toBe('full')
    expect(restored.invalid).toEqual(['先锋', '分队', '招募组合'])
    const session = getSession(restored.config, 'full')
    expect(session.squad).toBeNull(); expect(session.recruit).toBeNull(); expect(session.result.先锋).toBeNull()
    expect(restored.config.phantomOpening).toEqual(config.phantomOpening)
    expect(config.selectedTheme).toBe('mizuki')
  })
  it('刷新清空所有结果和锁定，保留模式、范围、收藏', () => {
    let config = drawnFull()
    const session = getSession(config, 'full')
    config = putSession(config, 'full', { ...session, squadLocked: true }) as typeof config
    config.phantomOpening = { excludedSquads: ['research'], excludedRecruits: [] }
    config.history = [{ ...captureModeRecord(config, operators, 'full')!, favorite: true, note: '测试收藏' }]
    config.locks.医疗 = true
    let stored = ''
    vi.stubGlobal('localStorage', { getItem: () => stored, setItem: (_key: string, text: string) => { stored = text } })
    saveConfig(config)
    const loaded = loadConfig(operators).config
    expect(getSession(loaded, 'full')).toEqual(blankSession())
    expect(loaded.randomMode).toBe('full'); expect(loaded.phantomOpening).toEqual(config.phantomOpening)
    expect(loaded.locks.医疗).toBe(false); expect(loaded.history).toEqual(config.history)
  })
  it('全职业全部锁定后刷新，首次生成和再次随机都保持未锁定', () => {
    const config = defaultConfig(operators)
    const drawn = drawSession(config, 'eight', operators, first).session
    const locked = { ...drawn, locks: Object.fromEntries(PROFESSIONS.map(p => [p, true])) as typeof drawn.locks }
    const saved = putSession(config, 'eight', locked)
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(saved) })
    const loaded = loadConfig(operators).config
    expect(getSession(loaded, 'eight')).toEqual(blankSession())
    const firstDraw = drawSession(loaded, 'eight', operators, first)
    expect(firstDraw.error).toBeUndefined()
    expect(firstDraw.session.locks).toEqual(blankSession().locks)
    expect(PROFESSIONS.every(p => firstDraw.session.result[p] !== null)).toBe(true)
    const next = drawSession(putSession(loaded, 'eight', firstDraw.session), 'eight', operators, first)
    expect(next.error).toBeUndefined()
    expect(next.session.locks).toEqual(blankSession().locks)
  })
  it('导入时清理已排除的分队组合及其锁定，保留旧备份与已有八职业数据', () => {
    let config = drawnFull()
    const session = getSession(config, 'full')
    config = putSession(config, 'full', { ...session, squadLocked: true, recruitLocked: true }) as typeof config
    config.phantomOpening = { excludedSquads: ['command'], excludedRecruits: ['first'] }
    const imported = parseImport(JSON.stringify(config), operators)
    expect(getSession(imported, 'full')).toMatchObject({ squad: null, recruit: null, squadLocked: false, recruitLocked: false })
    const legacy = defaultConfig(operators)
    legacy.currentResult.先锋 = operators.find(o => o.profession === '先锋')!.id
    legacy.locks.先锋 = true
    const old = parseImport(JSON.stringify(legacy), operators)
    expect(old).toEqual(legacy)
    expect(getSession(old, 'eight').result.先锋).toBe(legacy.currentResult.先锋)
    expect(getSession(old, 'eight').locks.先锋).toBe(true)
  })
  it('单干员记录恢复时检查资格并保留其他模式结果', () => {
    let config = drawnFull()
    const full = structuredClone(getSession(config, 'full'))
    config = putSession(config, 'single', drawSession(config, 'single', operators, first).session) as typeof config
    const row = captureModeRecord(config, operators, 'single')!
    const id = getSession(config, 'single').single!
    const restored = restoreModeRecord(row, config, operators)
    expect(restored.config.randomMode).toBe('single')
    expect(getSession(restored.config, 'single').single).toBe(id)
    expect(getSession(restored.config, 'full')).toEqual(full)
    config.operatorStates[id].enabled = false
    const invalid = restoreModeRecord(row, config, operators)
    expect(invalid.invalid).toHaveLength(1)
    expect(getSession(invalid.config, 'single').single).toBeNull()
  })
})
