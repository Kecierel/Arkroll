import { afterEach, describe, expect, it, vi } from 'vitest'
import { PROFESSIONS, type Operator, type RecruitCount } from '../types'
import { IS_THEMES } from '../data/themes'
import { blankLocks, blankResult, drawAll, lockExistingResults, redrawOne } from './randomizer'
import { defaultConfig, loadConfig } from './storage'
import { getSession, putSession, drawSession } from './sessions'
import { setRecruitCount, setSlotLock } from './lineup'
import { captureModeRecord, normalizeHistory, recordText, restoreModeRecord } from './history'
import { exportConfig, parseImport } from './configTransfer'

const operators: Operator[] = PROFESSIONS.flatMap((profession, p) => Array.from({ length: 4 }, (_, n) => ({ id: `${p}-${n}`, name: `${profession}${n}`, profession, rarity: 6 })))
const first = () => 0
const drawn = (count: RecruitCount = 3, mode: 'full' | 'eight' = 'eight') => {
  const config = setRecruitCount(defaultConfig(operators), count)
  return putSession(config, mode, drawSession(config, mode, operators, first).session)
}
function legacyConfig() {
  let config = drawn(1, 'full')
  config = putSession(config, 'eight', drawSession(config, 'eight', operators, first).session)
  config = putSession(config, 'single', drawSession(config, 'single', operators, first).session)
  config.currentResult.先锋[0] = '0-0'; config.locks.先锋[0] = true
  const full = getSession(config, 'full')
  full.locks.近卫[0] = true
  const row = captureModeRecord(config, operators, 'full', true)!
  const { recruitCount: _count, ...oldRow } = row
  const { recruitCount: _globalCount, ...oldConfig } = config
  const flat = <T,>(v: Record<string, T[]>) => Object.fromEntries(Object.entries(v).map(([p, items]) => [p, items[0]]))
  return { ...oldConfig, configVersion: 1, currentResult: flat(config.currentResult), locks: flat(config.locks), sessions: Object.fromEntries(Object.entries(config.sessions!).map(([key, session]) => [key, { ...session, result: flat(session.result), locks: flat(session.locks) }])), history: [{ ...oldRow, result: flat(row.result as Record<string, Operator[]>) }] }
}
afterEach(() => vi.unstubAllGlobals())

describe('0.5.0 ordered operator slots', () => {
  for (const count of [1, 2, 3] as const) for (const theme of IS_THEMES) it(`${theme.id}: ${count} distinct operators per profession with complete opening`, () => {
    let config = setRecruitCount(defaultConfig(operators), count)
    config = { ...config, selectedTheme: theme.id }
    const output = drawSession(config, 'full', operators, first)
    expect(output.error).toBeUndefined()
    for (const p of PROFESSIONS) {
      const ids = output.session.result[p]
      expect(ids).toHaveLength(count)
      expect(new Set(ids).size).toBe(count)
      expect(ids.every(id => operators.some(o => o.id === id && o.profession === p))).toBe(true)
    }
    config = putSession(config, 'full', output.session)
    const row = captureModeRecord(config, operators, 'full')!
    expect(row.recruitCount).toBe(count)
    expect(row.result.先锋).toHaveLength(count)
  })

  it('retains the locked middle slot, excludes it from other draws and never mutates input', () => {
    const config = drawn(), before = structuredClone(config.currentResult)
    const locks = setSlotLock(config.locks, '先锋', 1, true)
    const next = drawAll(operators, config.operatorStates, config.currentResult, locks, n => n - 1)
    expect(next.先锋[1]).toBe(before.先锋[1])
    expect(new Set(next.先锋).size).toBe(3)
    expect(next.先锋[0]).not.toBe(before.先锋[0])
    expect(config.currentResult).toEqual(before)
    expect(config.locks.先锋).toEqual([false, false, false])
  })

  it('single-slot redraw excludes siblings and its old result, preserving every other slot', () => {
    const config = drawn(), next = redrawOne('先锋', operators, config.operatorStates, config.currentResult, first, 1)
    expect(next.先锋).toEqual(['0-0', '0-3', '0-2'])
    for (const p of PROFESSIONS.slice(1)) expect(next[p]).toEqual(config.currentResult[p])
    config.operatorStates['0-3'].enabled = false
    expect(redrawOne('先锋', operators, config.operatorStates, config.currentResult, first, 1)).toEqual(config.currentResult)
    config.currentResult.先锋[1] = null
    expect(redrawOne('先锋', operators, config.operatorStates, config.currentResult, first, 1).先锋).toEqual(['0-0', '0-1', '0-2'])
  })

  it.each(['eight', 'full'] as const)('shortages cancel the entire %s draw without consuming randomness', mode => {
    const config = drawn(3, mode), before = structuredClone(getSession(config, mode)), pick = vi.fn(first)
    config.operatorStates['0-2'].enabled = false; config.operatorStates['0-3'].enabled = false
    const next = drawSession(config, mode, operators, pick)
    expect(next.error).toContain('先锋可用2名，需要3名（差1名）')
    expect(next.session).toEqual(before)
    expect(pick).not.toHaveBeenCalled()
    expect(captureModeRecord(config, operators, mode)).not.toBeNull()
  })

  it('an already locked result reserves a position even after eligibility changes', () => {
    let config = drawn()
    config.locks.先锋[0] = true
    config.operatorStates['0-0'].enabled = false; config.operatorStates['0-3'].enabled = false
    expect(drawSession(config, 'eight', operators, first).error).toBeUndefined()
    config = putSession(config, 'eight', drawSession(config, 'eight', operators, first).session)
    expect(config.currentResult.先锋).toEqual(['0-0', '0-1', '0-2'])
  })

  it('lock-all ignores empty slots; a partial locked lineup can still fill new slots', () => {
    const config = setRecruitCount(drawn(1), 3)
    const locked = lockExistingResults(config.currentResult, config.locks)
    expect(locked.先锋).toEqual([true, false, false])
    const next = drawAll(operators, config.operatorStates, config.currentResult, locked, first)
    expect(next.先锋).toEqual(['0-0', '0-1', '0-2'])
    expect(lockExistingResults(blankResult(3), blankLocks(3))).toEqual(blankLocks(3))
  })

  it('resizes every saved mode and theme, retaining leading slots without drawing or changing history/openings', () => {
    let config = drawn(1)
    for (const theme of IS_THEMES) {
      config.selectedTheme = theme.id
      config = putSession(config, 'full', drawSession(config, 'full', operators, first).session)
    }
    config.locks.先锋[0] = true
    config.history = [captureModeRecord(config, operators, 'eight')!]
    const original = structuredClone(config), grown = setRecruitCount(config, 3)
    expect(grown.currentResult.先锋).toEqual(['0-0', null, null])
    expect(grown.locks.先锋).toEqual([true, false, false])
    for (const key of Object.keys(grown.sessions!)) {
      expect(grown.sessions![key].result.先锋).toEqual(['0-0', null, null])
      expect(grown.sessions![key].squad).toBe(config.sessions![key].squad)
    }
    grown.currentResult.先锋[2] = '0-2'; grown.locks.先锋[2] = true
    const shrunk = setRecruitCount(grown, 1), regrown = setRecruitCount(shrunk, 3)
    expect(regrown.currentResult.先锋).toEqual(['0-0', null, null])
    expect(regrown.locks.先锋).toEqual([true, false, false])
    expect(regrown.history).toEqual(original.history)
    expect(config).toEqual(original)
  })

  it('captures ordered independent snapshots and only accepts complete lineups', () => {
    const config = drawn(), row = captureModeRecord(config, operators, 'eight')!
    expect(recordText(row)).toContain('先锋：第1次六星招募 先锋0 → 第2次六星招募 先锋1 → 第3次六星招募 先锋2')
    expect(recordText(row)).toContain('之后自由选择')
    config.currentResult.先锋[1] = null
    expect(row.result.先锋![1].id).toBe('0-1')
    expect(captureModeRecord(config, operators, 'eight')).toBeNull()
  })

  it('migrates actual v1 results, sessions, locks, favorites and snapshots', () => {
    const legacy = legacyConfig(), config = parseImport(JSON.stringify(legacy), operators)
    expect(config.configVersion).toBe(2); expect(config.recruitCount).toBe(1)
    expect(config.currentResult.先锋).toEqual(['0-0']); expect(config.locks.先锋).toEqual([true])
    expect(getSession(config, 'full').locks.近卫).toEqual([true])
    expect(getSession(config, 'single').single).toBe('0-0')
    expect(config.history![0].result.先锋![0].id).toBe('0-0')
    expect(config.history![0]).toMatchObject({ favorite: true, recruitCount: 1 })
    expect(parseImport(JSON.stringify(exportConfig(config)), operators)).toEqual(config)
  })

  it('v2 backup roundtrip preserves ordered slots and individual locks across all modes', () => {
    let config = drawn(3, 'full')
    config = putSession(config, 'eight', drawSession(config, 'eight', operators, first).session)
    config = putSession(config, 'single', drawSession(config, 'single', operators, first).session)
    config.locks.先锋[1] = true
    config.history = [captureModeRecord(config, operators, 'full', true)!, captureModeRecord(config, operators, 'single')!]
    expect(parseImport(JSON.stringify(exportConfig(config)), operators)).toEqual(config)
  })

  it('restores count, theme and mode; keeps invalid middle slot empty and unlocked', () => {
    const source = drawn(3, 'full'), row = captureModeRecord(source, operators, 'full')!
    let target = drawn(3, 'full')
    target.locks.先锋[0] = true
    target = setRecruitCount(target, 3)
    const full = getSession(target, 'full'); full.locks.先锋 = [true, true, true]
    target = putSession(target, 'full', full)
    target.operatorStates['0-1'].enabled = false
    target.selectedTheme = 'mizuki'
    const before = structuredClone(target), restored = restoreModeRecord(row, target, operators)
    expect(restored.config).toMatchObject({ recruitCount: 3, randomMode: 'full', selectedTheme: 'phantom' })
    const session = getSession(restored.config, 'full')
    expect(session.result.先锋).toEqual(['0-0', null, '0-2'])
    expect(session.locks.先锋).toEqual([true, false, true])
    expect(restored.invalid).toContain('先锋第2名')
    expect(target).toEqual(before)
    const oldRow = parseImport(JSON.stringify(legacyConfig()), operators).history![0]
    expect(restoreModeRecord(oldRow, restored.config, operators).config.recruitCount).toBe(1)
  })

  it('single mode ignores shared count, restores one operator without resizing other modes', () => {
    let config = drawn()
    config = putSession(config, 'single', drawSession(config, 'single', operators, first).session)
    const row = captureModeRecord(config, operators, 'single')!, restored = restoreModeRecord(row, config, operators)
    expect(row.recruitCount).toBe(1)
    expect(restored.config.recruitCount).toBe(3)
    expect(restored.config.currentResult).toEqual(config.currentResult)
  })

  it('reload preserves count, history and settings, but clears all slots and locks', () => {
    const config = drawn(3, 'full')
    config.locks.先锋[2] = true
    config.history = [captureModeRecord(config, operators, 'full', true)!]
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(config) })
    const loaded = loadConfig(operators).config
    expect(loaded.recruitCount).toBe(3)
    expect(loaded.currentResult).toEqual(blankResult(3)); expect(loaded.locks).toEqual(blankLocks(3))
    expect(getSession(loaded, 'full').result).toEqual(blankResult(3))
    expect(loaded.history).toEqual(config.history)
  })

  it.each(['result', 'session', 'history', 'count', 'locks', 'unknown', 'wrong-profession'] as const)('rejects malformed %s without modifying source config', kind => {
    const config = drawn(3, 'full'), before = structuredClone(config)
    config.history = [captureModeRecord(config, operators, 'full')!]
    const bad = structuredClone(config)
    if (kind === 'result') bad.currentResult.先锋 = ['0-0', '0-0', null]
    if (kind === 'session') getSession(bad, 'full').result.先锋 = ['0-0', '0-0', '0-2']
    if (kind === 'history') bad.history![0].result.先锋![1] = { ...bad.history![0].result.先锋![0] }
    if (kind === 'count') (bad as unknown as { recruitCount: number }).recruitCount = 4
    if (kind === 'locks') bad.locks.先锋 = [true]
    if (kind === 'unknown') bad.currentResult.先锋 = ['missing', null, null]
    if (kind === 'wrong-profession') bad.currentResult.先锋 = ['1-0', null, null]
    expect(() => parseImport(JSON.stringify(bad), operators)).toThrow()
    expect(config.currentResult).toEqual(before.currentResult)
  })

  it('keeps removed operators in historical snapshots, but leaves their restored positions empty', () => {
    const config = drawn(), row = captureModeRecord(config, operators, 'eight')!
    row.result.先锋![1].id = 'removed'
    config.history = [row]
    expect(parseImport(JSON.stringify(config), operators).history).toEqual([row])
    const restored = restoreModeRecord(normalizeHistory([row])[0], config, operators)
    expect(restored.config.currentResult.先锋).toEqual(['0-0', null, '0-2'])
  })
})
