import { getThemeOpening, type OpeningOption } from '../data/openings'
import { DEFAULT_THEME_ID, type ISThemeId } from '../data/themes'
import type { LocalConfig } from '../types'

export interface OpeningSettings { excludedSquads: string[]; excludedRecruits: string[] }
export const defaultOpeningSettings = (): OpeningSettings => ({ excludedSquads: [], excludedRecruits: [] })
export function normalizeOpeningSettings(value: unknown, theme: ISThemeId = DEFAULT_THEME_ID): OpeningSettings {
  const raw = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
  const clean = (key: string, options: OpeningOption[]) => options.filter(o => Array.isArray(raw[key]) && raw[key].includes(o.id)).map(o => o.id)
  const data = getThemeOpening(theme)
  return { excludedSquads: clean('excludedSquads', data.squads), excludedRecruits: clean('excludedRecruits', data.recruits) }
}
export function getOpeningSettings(config: LocalConfig, theme: ISThemeId = config.selectedTheme ?? DEFAULT_THEME_ID): OpeningSettings {
  return config.themeOpenings?.[theme] ?? (theme === 'phantom' ? config.phantomOpening : undefined) ?? defaultOpeningSettings()
}
export function setOpeningSettings(config: LocalConfig, theme: ISThemeId, settings: OpeningSettings): LocalConfig {
  const key = `full:${theme}`, current = config.sessions?.[key]
  const next = current ? { ...current } : undefined
  if (next) {
    if (next.squad && settings.excludedSquads.includes(next.squad)) { next.squad = null; next.squadLocked = false }
    if (next.recruit && settings.excludedRecruits.includes(next.recruit)) { next.recruit = null; next.recruitLocked = false }
  }
  return { ...config, themeOpenings: { ...config.themeOpenings, [theme]: settings }, ...(theme === 'phantom' ? { phantomOpening: settings } : {}), ...(next ? { sessions: { ...config.sessions, [key]: next } } : {}) }
}
export function pickOpening(options: OpeningOption[], excluded: string[], current: string | null, locked: boolean, random = Math.random): string | null {
  const pool = options.filter(o => !excluded.includes(o.id))
  if (locked && pool.some(o => o.id === current)) return current
  const alternatives = pool.filter(o => o.id !== current)
  const candidates = alternatives.length ? alternatives : pool
  return candidates.length ? candidates[Math.floor(random() * candidates.length)].id : null
}
