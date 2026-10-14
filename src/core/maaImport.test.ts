import { describe, expect, it } from 'vitest'
import database from '../data/operators.json'
import { PROFESSIONS, type Operator } from '../types'
import { defaultConfig } from './storage'
import { applyMaaImport, previewMaaImport } from './maaImport'
import { parseBackupWithMigration } from './legacyBackup'
import { drawAll, redrawOne, blankLocks, blankResult } from './randomizer'

const operators = database.operators as Operator[]
const firstByProfession = PROFESSIONS.map(profession => operators.find(operator => operator.profession === profession)!)
const sampleExport = (extra: object[] = []) => JSON.stringify([
  ...firstByProfession.map((operator, index) => ({ id: operator.id, name: operator.name, rarity: 6, own: index % 2 === 0, elite: 0, level: 1, potential: 1 })),
  ...extra,
])

describe('v0.2 正式数据', () => {
  it('八职业均有六星候选且没有 SAMPLE 数据', () => {
    expect(operators.length).toBeGreaterThanOrEqual(PROFESSIONS.length)
    expect(operators.every(operator => typeof operator.id === 'string' && operator.id.trim().length > 0 && typeof operator.name === 'string' && operator.name.trim().length > 0 && PROFESSIONS.includes(operator.profession))).toBe(true)
    expect(new Set(operators.map(operator => operator.id)).size).toBe(operators.length)
    expect(operators.every(operator => operator.rarity === 6 && !operator.id.startsWith('sample_'))).toBe(true)
    for (const profession of PROFESSIONS) expect(operators.some(operator => operator.profession === profession)).toBe(true)
  })
  it('正式数据仍满足抽取、锁定和单职业重抽', () => {
    const config = defaultConfig(operators)
    const current = drawAll(operators, config.operatorStates, config.settings, blankResult(), blankLocks(), () => 0)
    for (const profession of PROFESSIONS) expect(operators.find(operator => operator.id === current[profession])?.profession).toBe(profession)
    const next = redrawOne('先锋', operators, config.operatorStates, config.settings, current, () => 0)
    expect(next.先锋).not.toBe(current.先锋)
    for (const profession of PROFESSIONS.slice(1)) expect(next[profession]).toBe(current[profession])
    const locked = drawAll(operators, config.operatorStates, config.settings, current, { ...blankLocks(), 先锋: true }, length => length - 1)
    expect(locked.先锋).toBe(current.先锋)
  })
})

describe('MAA 导入', () => {
  it('预览后只更新匹配的拥有状态', () => {
    const config = defaultConfig(operators)
    config.operatorStates[firstByProfession[0].id].enabled = false
    const preview = previewMaaImport(sampleExport(), operators, config.operatorStates)
    expect(preview.matched).toBe(8)
    expect(preview.gained).toBe(4)
    expect(preview.missingLocal).toBe(operators.length - 8)
    const next = applyMaaImport(preview, config)
    expect(next.operatorStates[firstByProfession[0].id]).toEqual({ owned: true, enabled: false })
    expect(next.settings).toEqual(config.settings)
    expect(next.locks).toEqual(config.locks)
    expect(config.operatorStates[firstByProfession[0].id].owned).toBe(false)
  })
  it('报告未知六星和较旧名单，未出现的干员保持原状态', () => {
    const config = defaultConfig(operators)
    const missing = operators.find(operator => !firstByProfession.includes(operator))!
    config.operatorStates[missing.id].owned = true
    const preview = previewMaaImport(sampleExport([{ id: 'char_999_unknown', name: '未知', rarity: 6, own: true }]), operators, config.operatorStates)
    expect(preview.unknownSixStar).toBe(1)
    expect(applyMaaImport(preview, config).operatorStates[missing.id].owned).toBe(true)
  })
  it('无效 JSON、重复 ID、错误名称和不完整职业不会覆盖数据', () => {
    const config = defaultConfig(operators)
    expect(() => previewMaaImport('{', operators, config.operatorStates)).toThrow()
    expect(() => previewMaaImport(sampleExport([{ ...JSON.parse(sampleExport())[0] }]), operators, config.operatorStates)).toThrow('重复')
    const wrong = JSON.parse(sampleExport()) as Array<{name: string}>
    wrong[0].name = '错误名称'
    expect(() => previewMaaImport(JSON.stringify(wrong), operators, config.operatorStates)).toThrow('名称')
    const incomplete = JSON.parse(sampleExport()) as object[]
    expect(() => previewMaaImport(JSON.stringify(incomplete.slice(0, 1)), operators, config.operatorStates)).toThrow('八个职业')
    expect(config).toEqual(defaultConfig(operators))
  })
  it('旧 SAMPLE 备份保留设置并清空无法对应的结果', () => {
    const legacy = { ...defaultConfig(operators), settings: { ownedOnly: true }, locks: { ...blankLocks(), 先锋: true }, operatorStates: { sample_vanguard_a: { owned: true, enabled: false } }, currentResult: { ...blankResult(), 先锋: 'sample_vanguard_a' } }
    const imported = parseBackupWithMigration(JSON.stringify(legacy), operators)
    expect(imported.discardedSample).toBe(true)
    expect(imported.config.settings.ownedOnly).toBe(true)
    expect(imported.config.locks.先锋).toBe(true)
    expect(imported.config.currentResult.先锋).toBeNull()
    expect(imported.config.operatorStates[operators[0].id]).toEqual({ owned: false, enabled: true })
  })
})
