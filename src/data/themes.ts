export const IS_THEMES = [
  { id: 'phantom', name: '傀影与猩红孤钻' },
  { id: 'mizuki', name: '水月与深蓝之树' },
  { id: 'sami', name: '探索者的银凇止境' },
  { id: 'sarkaz', name: '萨卡兹的无终奇语' },
  { id: 'sui', name: '岁的界园志异' },
  { id: 'seaborn', name: '沉沦者的黑流树海' },
] as const

export type ISThemeId = typeof IS_THEMES[number]['id']
export const DEFAULT_THEME_ID: ISThemeId = 'phantom'
export function isISThemeId(value: unknown): value is ISThemeId {
  return IS_THEMES.some(theme => theme.id === value)
}
