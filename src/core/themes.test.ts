import { afterEach, expect, it, vi } from 'vitest'
import { DEFAULT_THEME_ID, IS_THEMES } from '../data/themes'
import { defaultConfig, loadConfig, normalizeConfig, saveConfig } from './storage'
import { exportConfig, parseImport } from './configTransfer'

afterEach(() => vi.unstubAllGlobals())

it('旧配置和未知主题回退到默认主题', () => {
  expect(defaultConfig([]).selectedTheme).toBe(DEFAULT_THEME_ID)
  for (const selectedTheme of [undefined, null, 'unknown', {}, 1]) {
    expect(normalizeConfig({ configVersion: 1, selectedTheme }, []).selectedTheme).toBe(DEFAULT_THEME_ID)
  }
})

it('六个主题均可保存、刷新恢复和备份往返，保留已有设置', () => {
  let stored = ''
  vi.stubGlobal('localStorage', { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value } })
  for (const theme of IS_THEMES) {
    const config = { ...defaultConfig([]), selectedTheme: theme.id }
    config.locks.先锋[0] = true
    expect(saveConfig(config)).toBe(true)
    expect(loadConfig([]).config.selectedTheme).toBe(theme.id)
    expect(loadConfig([]).config.locks.先锋[0]).toBe(false)
    expect(parseImport(JSON.stringify(exportConfig(config)), [])).toEqual({ ...config, locks: { ...config.locks, 先锋: [false] } })
  }
})
