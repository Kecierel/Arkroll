import { describe, expect, it } from 'vitest'
import database from '../data/operators.json'
import type { Operator } from '../types'
import { defaultConfig, normalizeConfig } from './storage'
import { parseImport } from './configTransfer'
import { applyMaaImport, previewMaaImport } from './maaImport'
import { blankLocks, blankResult, drawAll } from './randomizer'

const operators = database.operators as Operator[]
const additions: Operator[] = [
  { id: 'char_4247_oxi', name: '塔露拉', profession: '近卫', rarity: 6 },
  { id: 'char_4244_tocka', name: '冻河', profession: '辅助', rarity: 6 },
  { id: 'char_4246_dminon', name: '国度', profession: '特种', rarity: 6 }
]
const oldOperators = operators.filter(operator => !additions.some(added => added.id === operator.id))

describe('2026-11-04干员增量更新', () => {
  it('完整ID唯一，三人的名称、职业与六星标记匹配核对记录', () => {
    expect(new Set(operators.map(operator => operator.id)).size).toBe(operators.length)
    for (const added of additions) expect(operators.find(operator => operator.id === added.id)).toEqual(added)
  })

  it('旧配置加载及备份导入保留旧状态，并补齐新增干员默认状态', () => {
    const old = defaultConfig(oldOperators)
    old.operatorStates[oldOperators[0].id] = { owned: true, enabled: false }
    for (const updated of [normalizeConfig(old, operators), parseImport(JSON.stringify(old), operators)]) {
      for (const operator of oldOperators) expect(updated.operatorStates[operator.id]).toEqual(old.operatorStates[operator.id])
      for (const added of additions) expect(updated.operatorStates[added.id]).toEqual({ owned: false, enabled: true })
    }
  })

  it('MAA全量导入匹配三人，启用后可抽取到对应职业', () => {
    const config = defaultConfig(operators)
    const rows = operators.map(operator => ({ ...operator, own: true }))
    const preview = previewMaaImport(JSON.stringify(rows), operators, config.operatorStates)
    expect(preview.unknownSixStar).toBe(0)
    expect(preview.matched).toBe(operators.length)
    const imported = applyMaaImport(preview, config)
    for (const added of additions) expect(imported.operatorStates[added.id]).toEqual({ owned: true, enabled: true })
    for (const operator of oldOperators) {
      if (additions.some(added => added.profession === operator.profession)) imported.operatorStates[operator.id].enabled = false
    }
    const result = drawAll(operators, imported.operatorStates, blankResult(), blankLocks(), () => 0)
    for (const added of additions) expect(result[added.profession]).toEqual([added.id])
  })
})
