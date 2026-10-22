import { describe, expect, it, vi, afterEach } from 'vitest'
import database from '../data/operators.json'
import type { LocalConfig, Operator } from '../types'
import { PROFESSIONS } from '../types'
import { applyTraining, meetsThreshold, normalizeTraining, parseTraining, previewConfigTraining, trainingLabel, setOperatorTraining } from './training'
import { applyMaaImport, previewMaaImport } from './maaImport'
import { defaultConfig, loadConfig, saveConfig, STORAGE_KEY } from './storage'
import { exportConfig } from './configTransfer'
import { parseBackupWithMigration } from './legacyBackup'
import { drawSession, getSession, putSession } from './sessions'

const operators = database.operators as Operator[]
const ids = operators.slice(0, 5).map(o => o.id)
function source() { return operators.map(o => ({ id: o.id, name: o.name, rarity: 6, own: true, elite: 2, level: 60 })) }
function trained(): LocalConfig {
  const config = defaultConfig(operators)
  return applyMaaImport(previewMaaImport(JSON.stringify(source()), operators, config.operatorStates), config)
}
afterEach(() => vi.unstubAllGlobals())

describe('练度字段与门槛', () => {
  it.each([[0, 50], [1, 80], [2, 1], [2, 90]])('接受六星精英%s等级%s', (elite, level) => { expect(parseTraining({ elite, level })).toEqual({ elite, level }) })
  it.each([{}, { elite: 2 }, { elite: 2, level: '60' }, { elite: '2', level: 60 }, { elite: 3, level: 1 }, { elite: -1, level: 1 }, { elite: 0, level: 51 }, { elite: 1, level: 81 }, { elite: 2, level: 91 }, { elite: 2, level: 0 }, { elite: 2, level: 1.5 }, { elite: 2, level: NaN }, null])('无效练度归为未知 %j', value => { expect(parseTraining(value)).toBeUndefined() })
  it('临界值与跨阶段比较', () => {
    expect(meetsThreshold({ elite: 1, level: 80 }, 1)).toBe(false)
    expect(meetsThreshold({ elite: 2, level: 1 }, 1)).toBe(true)
    expect(meetsThreshold({ elite: 2, level: 59 }, 60)).toBe(false)
    expect(meetsThreshold({ elite: 2, level: 60 }, 60)).toBe(true)
    expect(meetsThreshold({ elite: 2, level: 90 }, 60)).toBe(true)
    expect(trainingLabel()).toBe('练度未知')
  })
})

describe('导入练度与再次筛选', () => {
  it('预览名单、数量、写入一致且不修改输入', () => {
    const rows = source(), config = defaultConfig(operators), before = structuredClone(config)
    rows[0].elite = 1; rows[0].level = 80
    rows[1].level = 59
    rows[2].level = 0
    rows[3].own = false
    const preview = previewMaaImport(JSON.stringify(rows), operators, config.operatorStates, 60)
    expect(config).toEqual(before)
    expect(preview.filter?.below.map(o => o.id)).toEqual(ids.slice(0, 2))
    expect(preview.filter?.unknown.map(o => o.id)).toEqual([ids[2]])
    expect(preview.filter?.enabledCount).toBe(operators.length - 4)
    const next = applyMaaImport(preview, config)
    for (const id of ids.slice(0, 3)) expect(next.operatorStates[id]).toEqual({ owned: true, enabled: false })
    expect(next.operatorStates[ids[3]]).toEqual({ owned: false, enabled: false })
    expect(Object.values(next.operatorStates).filter(s => s.enabled).length).toBe(preview.filter?.enabledCount)
    expect(next.trainingThreshold).toBe(60)
  })
  it('关闭筛选仍保存练度，重复导入清除缺失与无效旧练度', () => {
    const config = trained(), rows: Array<Record<string, unknown>> = source()
    delete rows[0].elite; rows[1].level = 999; rows[2].own = false
    const missing = rows.splice(4, 1)[0].id as string
    const next = applyMaaImport(previewMaaImport(JSON.stringify(rows), operators, config.operatorStates), config)
    expect(next.operatorStates[ids[0]]).toEqual({ owned: true, enabled: true })
    for (const id of [ids[0], ids[1], ids[2], missing]) expect(next.operatorTraining?.[id]).toBeUndefined()
    expect(next.operatorStates[missing]).toEqual({ owned: false, enabled: false })
    expect(config.operatorTraining?.[ids[0]]).toBeDefined()
  })
  it('再次筛选不改变拥有且覆盖手动选择，降低门槛可重新启用', () => {
    const config = trained()
    config.operatorTraining![ids[0]].level = 1
    delete config.operatorTraining![ids[1]]
    config.operatorStates[ids[2]].owned = false
    config.operatorStates[ids[3]].enabled = false
    const before = structuredClone(config), preview = previewConfigTraining(config, operators, 60)
    expect(config).toEqual(before)
    const next = applyTraining(config, operators, 60)
    expect(next.operatorStates[ids[0]].enabled).toBe(false)
    expect(next.operatorStates[ids[1]].enabled).toBe(false)
    expect(next.operatorStates[ids[2]]).toEqual({ owned: false, enabled: false })
    expect(next.operatorStates[ids[3]].enabled).toBe(true)
    expect(Object.values(next.operatorStates).filter(s => s.enabled).length).toBe(preview.enabledCount)
    expect(applyTraining(next, operators, 1).operatorStates[ids[0]].enabled).toBe(true)
    expect(config).toEqual(before)
  })
  it('筛选读取当前拥有状态，保留会话、锁定、结果及历史', () => {
    let config = trained()
    config = putSession(config, 'full', drawSession(config, 'full', operators, () => 0).session)
    config.locks.先锋 = true
    config.history = []
    config.operatorStates[ids[0]].owned = false
    const next = applyTraining(config, operators, 1)
    expect(next.operatorStates[ids[0]]).toEqual({ owned: false, enabled: false })
    for (const key of ['sessions', 'locks', 'currentResult', 'history'] as const) expect(next[key]).toEqual(config[key])
    const imported = applyMaaImport(previewMaaImport(JSON.stringify(source()), operators, config.operatorStates, 60), config)
    for (const key of ['sessions', 'locks', 'currentResult', 'history'] as const) expect(imported[key]).toEqual(config[key])
  })
  it.each(['full', 'eight', 'single'] as const)('%s模式只抽筛选后候选，无候选时保留结果', mode => {
    const config = trained()
    // Keep one eligible operator per profession, with other owned operators below threshold.
    const candidates = PROFESSIONS.map(p => operators.find(o => o.profession === p)!.id)
    for (const o of operators) config.operatorTraining![o.id].level = candidates.includes(o.id) ? 60 : 1
    const next = applyTraining(config, operators, 60), draw = drawSession(next, mode, operators, () => 0)
    expect(draw.error).toBeUndefined()
    const resultIds = mode === 'single' ? [draw.session.single] : Object.values(draw.session.result)
    expect(resultIds.every(id => id && candidates.includes(id))).toBe(true)
    const stored = putSession(next, mode, draw.session)
    stored.operatorTraining = {}
    const empty = applyTraining(stored, operators, 60), failed = drawSession(empty, mode, operators, () => 0)
    expect(failed.error).toBeTruthy()
    expect(failed.session).toEqual(getSession(stored, mode))
  })
})

describe('练度存储与备份', () => {
  it('旧备份可恢复，新备份往返保存练度与门槛', () => {
    const old = defaultConfig(operators)
    const restored = parseBackupWithMigration(JSON.stringify(exportConfig(old)), operators).config
    expect(restored.operatorTraining).toBeUndefined()
    expect(restored.trainingThreshold ?? 1).toBe(1)
    const next = applyTraining(trained(), operators, 60)
    expect(parseBackupWithMigration(JSON.stringify(exportConfig(next)), operators).config).toEqual(next)
  })
  it('恢复时清除非法练度和未知ID，忽略非法门槛', () => {
    const config = { ...trained(), trainingThreshold: 90, operatorTraining: { [ids[0]]: { elite: 1, level: 90 }, [ids[1]]: { elite: 2, level: 60 }, unknown: { elite: 2, level: 60 } } }
    const restored = parseBackupWithMigration(JSON.stringify(config), operators).config
    expect(restored.operatorTraining).toEqual({ [ids[1]]: { elite: 2, level: 60 } })
    expect(restored.trainingThreshold).toBeUndefined()
    expect(normalizeTraining(null, operators)).toEqual({})
  })
  it('刷新保留练度与偏好，沿用原存储键和版本', () => {
    const memory = new Map<string, string>()
    vi.stubGlobal('localStorage', { setItem: (k: string, v: string) => memory.set(k, v), getItem: (k: string) => memory.get(k) ?? null })
    const config = applyTraining(trained(), operators, 60)
    expect(saveConfig(config)).toBe(true)
    expect(memory.has(STORAGE_KEY)).toBe(true)
    expect(loadConfig(operators).config).toMatchObject({ configVersion: 1, operatorTraining: config.operatorTraining, trainingThreshold: 60 })
  })
})

describe('手动编辑练度', () => {
  it('仅修改练度，保持拥有、启用、结果和其他练度', () => {
    const config = trained(), before = structuredClone(config)
    const next = setOperatorTraining(config, ids[0], { elite: 1, level: 80 })
    expect(next.operatorTraining?.[ids[0]]).toEqual({ elite: 1, level: 80 })
    expect(next.operatorStates).toEqual(config.operatorStates)
    expect(next.currentResult).toEqual(config.currentResult)
    expect(next.operatorTraining?.[ids[1]]).toEqual(config.operatorTraining?.[ids[1]])
    expect(config).toEqual(before)
    expect(parseBackupWithMigration(JSON.stringify(exportConfig(next)), operators).config.operatorTraining).toEqual(next.operatorTraining)
  })
  it('未拥有或未知ID不能修改，也不能清除练度', () => {
    const config = trained()
    config.operatorStates[ids[0]].owned = false
    const before = structuredClone(config)
    expect(() => setOperatorTraining(config, ids[0], { elite: 2, level: 60 })).toThrow('已拥有')
    expect(() => setOperatorTraining(config, ids[0], undefined)).toThrow('已拥有')
    expect(() => setOperatorTraining(config, 'unknown', { elite: 2, level: 60 })).toThrow('已拥有')
    expect(config).toEqual(before)
  })
  it('拒绝非法编辑，清除后变为未知', () => {
    const config = trained(), before = structuredClone(config)
    for (const value of [{ elite: 0, level: 51 }, { elite: 1, level: 81 }, { elite: 2, level: 91 }, { elite: 2, level: 1.5 }, { elite: 2, level: 0 }]) expect(() => setOperatorTraining(config, ids[0], value)).toThrow('练度无效')
    expect(config).toEqual(before)
    const next = setOperatorTraining(config, ids[0], undefined)
    expect(next.operatorTraining?.[ids[0]]).toBeUndefined()
    expect(next.operatorStates).toEqual(config.operatorStates)
  })
  it('手动保存后可重筛，重新MAA导入仍覆盖手动值', () => {
    const config = setOperatorTraining(trained(), ids[0], { elite: 2, level: 1 })
    expect(applyTraining(config, operators, 60).operatorStates[ids[0]].enabled).toBe(false)
    const imported = applyMaaImport(previewMaaImport(JSON.stringify(source()), operators, config.operatorStates), config)
    expect(imported.operatorTraining?.[ids[0]]).toEqual({ elite: 2, level: 60 })
  })
})
