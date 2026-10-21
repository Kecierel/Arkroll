import { afterEach, describe, expect, it, vi } from 'vitest'
import database from '../data/operators.json'
import sources from '../data/openingSources.json'
import { IS_THEMES } from '../data/themes'
import { getThemeOpening } from '../data/openings'
import { PROFESSIONS, type LocalConfig, type Operator } from '../types'
import { defaultConfig, loadConfig, saveConfig } from './storage'
import { blankSession, drawSession, getSession, putSession } from './sessions'
import { getOpeningSettings, normalizeOpeningSettings, setOpeningSettings } from './opening'
import { captureModeRecord, normalizeHistory, recordText, restoreModeRecord } from './history'
import { exportConfig, parseImport } from './configTransfer'

const operators = database.operators as Operator[]
afterEach(() => vi.unstubAllGlobals())

describe.each(IS_THEMES)('$name', theme => {
  it('分队与组合名单与本次PRTS页面提取清单完全一致，ID唯一', () => {
    const data = getThemeOpening(theme.id), evidence = sources[theme.id]
    expect(data.squads.map(o => o.name)).toEqual(evidence.squads)
    expect(data.recruits.map(o => o.name)).toEqual(evidence.recruits)
    for (const list of [data.squads, data.recruits]) {
      expect(new Set(list.map(o => o.id)).size).toBe(list.length)
      expect(list.every(o => o.name && o.effect && o.unlock)).toBe(true)
    }
    expect(data.sourceRevision).toBe(evidence.revision)
  })
  it('所有候选均能抽到，排除、十项锁定、空池保护与记录往返适用当前主题', () => {
    let config: LocalConfig = { ...defaultConfig(operators), selectedTheme: theme.id, randomMode: 'full' }
    const data = getThemeOpening(theme.id)
    for (let index = 0; index < Math.max(data.squads.length, data.recruits.length); index++) {
      const draw = drawSession(config, 'full', operators, length => index % length)
      expect(draw.error).toBeUndefined()
      expect(draw.session.squad).toBe(data.squads[index % data.squads.length].id)
      expect(draw.session.recruit).toBe(data.recruits[index % data.recruits.length].id)
    }
    config = setOpeningSettings(config, theme.id, { excludedSquads: data.squads.slice(0, -1).map(o => o.id), excludedRecruits: data.recruits.slice(0, -1).map(o => o.id) })
    const draw = drawSession(config, 'full', operators).session
    expect(draw.squad).toBe(data.squads.at(-1)!.id); expect(draw.recruit).toBe(data.recruits.at(-1)!.id)
    config = putSession(config, 'full', { ...draw, squadLocked: true, recruitLocked: true, locks: Object.fromEntries(PROFESSIONS.map(p => [p, true])) as typeof draw.locks })
    expect(drawSession(config, 'full', operators).session).toEqual(getSession(config, 'full'))
    const row = captureModeRecord(config, operators, 'full', true)!
    expect(row.theme).toBe(theme.id)
    expect(recordText(row)).toContain(theme.name)
    expect(recordText(row)).toContain(data.squads.at(-1)!.name)
    expect(normalizeHistory([row])).toEqual([row])
    config.history = [row]
    expect(parseImport(JSON.stringify(exportConfig(config)), operators)).toEqual(config)
    const emptied = setOpeningSettings(config, theme.id, { ...getOpeningSettings(config), excludedRecruits: data.recruits.map(o => o.id) })
    expect(getSession(emptied, 'full').recruit).toBeNull()
    expect(getSession(emptied, 'full').recruitLocked).toBe(false)
    expect(drawSession(emptied, 'full', operators).session).toEqual(getSession(emptied, 'full'))
    expect(drawSession(emptied, 'full', operators).error).toContain('招募组合')
    const restored = restoreModeRecord(row, { ...emptied, selectedTheme: 'phantom', randomMode: 'single' }, operators)
    expect(restored.config.selectedTheme).toBe(theme.id); expect(restored.config.randomMode).toBe('full')
    expect(restored.invalid).toContain('招募组合')
  })
})

it('相同ID在各主题中独立配置和保存，会话、历史、备份完整往返', () => {
  let config = defaultConfig(operators)
  for (const [index, theme] of IS_THEMES.entries()) {
    config = { ...config, selectedTheme: theme.id }
    const data = getThemeOpening(theme.id)
    config = setOpeningSettings(config, theme.id, { excludedSquads: [data.squads[index % data.squads.length].id], excludedRecruits: [data.recruits[index % data.recruits.length].id] })
    config = putSession(config, 'full', drawSession(config, 'full', operators, () => 0).session)
    config.history = [...(config.history ?? []), captureModeRecord(config, operators, 'full')!]
  }
  const imported = parseImport(JSON.stringify(exportConfig(config)), operators)
  expect(imported).toEqual(config)
  for (const theme of IS_THEMES) {
    const selected = { ...imported, selectedTheme: theme.id }
    expect(getSession(selected, 'full')).toEqual(getSession({ ...config, selectedTheme: theme.id }, 'full'))
    expect(getSession(selected, 'full').squad).not.toBeNull()
  }
  let stored = ''
  vi.stubGlobal('localStorage', { getItem: () => stored, setItem: (_key: string, text: string) => { stored = text } })
  saveConfig(config)
  const loaded = loadConfig(operators).config
  for (const theme of IS_THEMES) {
    expect(getSession({ ...loaded, selectedTheme: theme.id }, 'full')).toEqual(blankSession())
    expect(getOpeningSettings(loaded, theme.id)).toEqual(getOpeningSettings(config, theme.id))
  }
  expect(loaded.history).toEqual(config.history)
})

it('旧傀影范围仅对傀影生效，不迁移到其他主题；未知选项按对应主题清理', () => {
  const config = parseImport(JSON.stringify({ ...defaultConfig(operators), phantomOpening: { excludedSquads: ['command'], excludedRecruits: ['random'] } }), operators)
  expect(getOpeningSettings(config, 'phantom').excludedSquads).toEqual(['command'])
  expect(getOpeningSettings(config, 'mizuki').excludedSquads).toEqual([])
  expect(normalizeOpeningSettings({ excludedSquads: ['tourist', 'command'], excludedRecruits: ['flexible'] }, 'mizuki')).toEqual({ excludedSquads: ['command'], excludedRecruits: [] })
  expect(normalizeOpeningSettings({ excludedSquads: ['tourist', 'command'], excludedRecruits: ['flexible'] }, 'sui')).toEqual({ excludedSquads: ['tourist', 'command'], excludedRecruits: ['flexible'] })
})

it('主题差异：直升规则、希望减免、临招星级和新增组合不混用', () => {
  const effect = (theme: typeof IS_THEMES[number]['id'], id: string) => getThemeOpening(theme).squads.find(o => o.id === id)!.effect
  expect(effect('phantom', 'assault')).toContain('直接进阶')
  expect(effect('mizuki', 'assault')).toContain('概率')
  expect(effect('sami', 'assault')).toContain('概率')
  expect(effect('sarkaz', 'assault')).toContain('共享首次')
  expect(effect('sui', 'assault')).toContain('各少消耗1希望')
  expect(effect('seaborn', 'assault')).toContain('招募少消耗2希望')
  for (const theme of IS_THEMES) {
    const data = getThemeOpening(theme.id)
    const stars = ['phantom', 'mizuki', 'sami'].includes(theme.id) ? 4 : 5
    expect(data.recruits.find(o => o.id === 'random')!.effect).toMatch(new RegExp(`${stars}[★星]`))
    expect(data.recruits.some(o => o.id === 'flexible')).toBe(theme.id === 'sui' || theme.id === 'seaborn')
  }
  expect(getThemeOpening('seaborn').updating).toBe(true)
})
