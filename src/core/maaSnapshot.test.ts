import { describe, expect, it } from 'vitest'
import database from '../data/operators.json'
import type { Operator } from '../types'
import { defaultConfig, normalizeConfig } from './storage'
import { previewMaaImport, applyMaaImport } from './maaImport'
import { normalizeMaaSnapshot, restoreMaaSnapshot } from './maaSnapshot'
import { applyTraining, setOperatorTraining } from './training'
import { parseBackupWithMigration } from './legacyBackup'
import { exportConfig } from './configTransfer'
import { drawSession, putSession } from './sessions'

const operators = database.operators as Operator[]
const rows = () => operators.map((o, i) => ({ id: o.id, name: o.name, rarity: 6, own: i !== 0, elite: 2, level: i === 1 ? 1 : 60 }))
function imported() { const config = defaultConfig(operators); return applyMaaImport(previewMaaImport(JSON.stringify(rows()), operators, config.operatorStates, 60), config) }

describe('最近一次MAA配置快照', () => {
  it('只有应用导入创建快照，独立于可编辑状态', () => {
    const base = defaultConfig(operators)
    previewMaaImport(JSON.stringify(rows()), operators, base.operatorStates)
    expect(base.maaSnapshot).toBeUndefined()
    const config = imported(), snapshot = structuredClone(config.maaSnapshot)
    config.operatorStates[operators[1].id].enabled = true
    config.operatorTraining![operators[1].id].level = 90
    expect(config.maaSnapshot).toEqual(snapshot)
  })
  it('恢复拥有后按当前要求重算，保留当前练度、会话及历史', () => {
    let config = imported()
    const expected = structuredClone(config.maaSnapshot!)
    config = setOperatorTraining(config, operators[1].id, { elite: 2, level: 90 })
    config = applyTraining(config, operators, 1)
    config = putSession(config, 'single', drawSession(config, 'single', operators, () => 0).session)
    config.operatorStates[operators[0].id] = { owned: true, enabled: true }
    const before = structuredClone(config), restored = restoreMaaSnapshot(config, operators)
    expect(Object.fromEntries(Object.entries(restored.operatorStates).map(([id, state]) => [id, state.owned]))).toEqual(Object.fromEntries(Object.entries(expected.operatorStates).map(([id, state]) => [id, state.owned])))
    expect(restored.operatorTraining).toEqual(config.operatorTraining)
    for (const key of ['trainingThreshold', 'sessions', 'history', 'locks', 'currentResult', 'maaSnapshot'] as const) expect(restored[key]).toEqual(config[key])
    expect(restored.trainingThreshold).toBe(1)
    expect(restored.operatorStates[operators[1].id].enabled).toBe(true)
    expect(config).toEqual(before)
    restored.operatorTraining![operators[1].id].level = 90
    expect(restored.maaSnapshot).toEqual(expected)
  })
  it('再次导入替换快照，关闭导入筛选时记录拥有者启用', () => {
    const config = imported(), nextRows = rows(); nextRows[0].own = true
    const next = applyMaaImport(previewMaaImport(JSON.stringify(nextRows), operators, config.operatorStates), config)
    expect(next.maaSnapshot?.operatorStates[operators[0].id].owned).toBe(true)
    expect(next.maaSnapshot?.operatorStates[operators[1].id].enabled).toBe(true)
    expect(config.maaSnapshot?.operatorStates[operators[0].id].owned).toBe(false)
  })
  it('备份往返及规范化保留快照，旧备份无快照不推测', () => {
    const config = imported()
    const restored = parseBackupWithMigration(JSON.stringify(exportConfig(config)), operators).config
    expect(restored.maaSnapshot).toEqual(config.maaSnapshot)
    expect(normalizeConfig(config, operators).maaSnapshot).toEqual(config.maaSnapshot)
    const old = defaultConfig(operators)
    expect(parseBackupWithMigration(JSON.stringify(old), operators).config.maaSnapshot).toBeUndefined()
    expect(() => restoreMaaSnapshot(old, operators)).toThrow('重新导入')
  })
  it('无效快照不能伪造恢复，非法练度清为未知', () => {
    expect(normalizeMaaSnapshot({}, operators)).toBeUndefined()
    expect(normalizeMaaSnapshot({ operatorStates: { [operators[0].id]: { owned: false, enabled: true } } }, operators)).toBeUndefined()
    expect(normalizeMaaSnapshot({ operatorStates: { [operators[0].id]: { owned: 'yes', enabled: true } } }, operators)).toBeUndefined()
    const snapshot = structuredClone(imported().maaSnapshot!)
    snapshot.operatorTraining[operators[1].id].level = 999
    expect(normalizeMaaSnapshot(snapshot, operators)?.operatorTraining[operators[1].id]).toBeUndefined()
  })
  it('快照未记录的新干员禁用，保留隐藏练度，不影响已有记录', () => {
    const config = imported(), added = { ...operators[0], id: 'char_999_new', name: '新增' }
    config.operatorStates[added.id] = { owned: true, enabled: true }
    config.operatorTraining![added.id] = { elite: 2, level: 90 }
    const restored = restoreMaaSnapshot(config, [...operators, added])
    expect(restored.operatorStates[added.id]).toEqual({ owned: false, enabled: false })
    expect(restored.operatorTraining?.[added.id]).toEqual({ elite: 2, level: 90 })
    expect(restored.operatorStates[operators[1].id]).toEqual(config.maaSnapshot!.operatorStates[operators[1].id])
  })
  it('回归用户案例：精二30级误设未拥有，恢复后精二60级要求下仍禁用', () => {
    const base = defaultConfig(operators)
    const config = applyMaaImport(previewMaaImport(JSON.stringify(rows()), operators, base.operatorStates), base)
    const id = operators[1].id
    config.operatorTraining![id] = { elite: 2, level: 30 }
    config.operatorStates[id] = { owned: false, enabled: false }
    config.trainingThreshold = 60
    expect(config.maaSnapshot!.operatorStates[id].enabled).toBe(true)
    const restored = restoreMaaSnapshot(config, operators)
    expect(restored.operatorStates[id]).toEqual({ owned: true, enabled: false })
    expect(restored.operatorTraining?.[id]).toEqual({ elite: 2, level: 30 })
    expect(restored.maaSnapshot).toEqual(config.maaSnapshot)
  })
  it('使用当前练度判定达标与未知，不沿用快照启用状态', () => {
    const config = imported(), id = operators[1].id
    config.operatorTraining![id] = { elite: 2, level: 90 }
    config.operatorStates[id] = { owned: false, enabled: false }
    delete config.operatorTraining![operators[2].id]
    const restored = restoreMaaSnapshot(config, operators)
    expect(restored.operatorStates[id]).toEqual({ owned: true, enabled: true })
    expect(restored.operatorStates[operators[2].id]).toEqual({ owned: true, enabled: false })
  })

})
