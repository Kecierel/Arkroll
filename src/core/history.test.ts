import { describe, it, expect, vi } from 'vitest'
import database from '../data/operators.json'
import { PROFESSIONS, type Operator } from '../types'
import { captureRecord, normalizeHistory, restoreRecord, trimHistory } from './history'
import { defaultConfig, loadConfig, saveConfig } from './storage'
import { exportConfig, parseImport } from './configTransfer'

const operators = database.operators as Operator[]
function setup() {
  const config = defaultConfig(operators)
  for (const p of PROFESSIONS) config.currentResult[p] = operators.find(o => o.profession === p)!.id
  return config
}
describe('history and favorites', () => {
  it('captures independent snapshots and rejects incomplete lineups', () => {
    const config = setup(), row = captureRecord(config, operators)!
    config.currentResult.先锋 = null
    expect(row.result.先锋!.id).toBeTruthy()
    expect(row.rules).toContain('先锋候选')
    expect(captureRecord(config, operators)).toBeNull()
  })
  it('retains favorites and caps ordinary history at 30', () => {
    const row = captureRecord(setup(), operators)!
    const rows = Array.from({ length: 103 }, (_, i) => ({ ...row, id: String(i), favorite: i === 102 }))
    const trimmed = trimHistory(rows)
    expect(trimmed).toHaveLength(31)
    expect(normalizeHistory(rows)).toEqual(trimmed)
    expect(trimmed.at(-1)?.id).toBe('102')
    expect(trimmed.some(r => r.id === '30')).toBe(false)
  })
  it('restores eligible professions and reports invalid ones without changing settings', () => {
    const config = setup(), row = captureRecord(config, operators)!
    config.operatorStates[row.result.先锋!.id].enabled = false
    config.locks.先锋 = true
    const restored = restoreRecord(row, config, operators)
    expect(restored.invalid).toEqual(['先锋'])
    expect(restored.result.先锋).toBeNull()
    expect(restored.result.近卫).toBe(row.result.近卫!.id)
    expect(config.locks.先锋).toBe(true)
    expect(config.operatorStates[row.result.先锋!.id].enabled).toBe(false)
  })
  it('roundtrips backups and accepts old backups without history', () => {
    const config = setup(); config.history = [{ ...captureRecord(config, operators)!, favorite: true, note: '测试备注' }]
    expect(parseImport(JSON.stringify(exportConfig(config)), operators).history).toEqual(config.history)
    expect(parseImport(JSON.stringify(defaultConfig(operators)), operators).history ?? []).toEqual([])
  })
  it('preserves unavailable operator snapshots in backup but does not restore them', () => {
    const config = setup(), row = captureRecord(config, operators)!
    row.result.先锋!.id = 'removed-id'; config.history = [row]
    const imported = parseImport(JSON.stringify(config), operators)
    expect(imported.history![0].result.先锋!.id).toBe('removed-id')
    expect(restoreRecord(row, config, operators).invalid).toContain('先锋')
  })
  it('persists history on reload while clearing current results', () => {
    const config = setup(); config.history = [captureRecord(config, operators)!]
    let stored = ''
    vi.stubGlobal('localStorage', { setItem: (_key: string, value: string) => { stored = value }, getItem: () => stored })
    try { expect(saveConfig(config)).toBe(true); const loaded = loadConfig(operators); expect(loaded.config.history).toEqual(config.history); expect(loaded.config.currentResult.先锋).toBeNull() } finally { vi.unstubAllGlobals() }
  })
  it('rejects corrupt records, duplicate ids and oversized backups', () => {
    const row = captureRecord(setup(), operators)!
    expect(() => normalizeHistory([null])).toThrow()
    expect(() => normalizeHistory([{ ...row, result: {} }])).toThrow()
    expect(() => normalizeHistory([row, row])).toThrow()
    expect(() => normalizeHistory(Array.from({ length: 101 }, (_, i) => ({ ...row, id: String(i), favorite: true })))).toThrow()
  })
})
