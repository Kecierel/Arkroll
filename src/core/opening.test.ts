import { expect, it } from 'vitest'
import { PHANTOM_SQUADS as options } from '../data/openings'
import { normalizeOpeningSettings, pickOpening } from './opening'
import { defaultConfig } from './storage'
import { exportConfig, parseImport } from './configTransfer'

it('排除项不被抽中，重抽更换结果，锁定保留，空池返回空', () => {
  expect(pickOpening(options, ['command'], null, false, () => 0)).toBe('gathering')
  expect(pickOpening(options, [], 'command', false, () => 0)).toBe('gathering')
  expect(pickOpening(options, [], 'command', true)).toBe('command')
  expect(pickOpening(options, options.map(o => o.id), 'command', true)).toBeNull()
  expect(pickOpening(options, options.slice(1).map(o => o.id), 'command', false)).toBe('command')
})
it('清理无效配置，随机范围可以备份往返', () => {
  expect(normalizeOpeningSettings({ excludedSquads: ['command', 'command', 'bad'], excludedRecruits: null })).toEqual({ excludedSquads: ['command'], excludedRecruits: [] })
  const config = { ...defaultConfig([]), phantomOpening: { excludedSquads: ['command'], excludedRecruits: ['random'] } }
  expect(parseImport(JSON.stringify(exportConfig(config)), [])).toEqual(config)
})
