import type { LocalConfig } from '../types'
import { getThemeOpening } from '../data/openings'
import { IS_THEMES, type ISThemeId } from '../data/themes'
import { getOpeningSettings, setOpeningSettings } from '../core/opening'
import './randomRangeSettings.css'

export default function RandomRangeSettings({ config, onChange }: { config: LocalConfig; onChange: (next: LocalConfig) => boolean }) {
  function exclude(theme: ISThemeId, key: 'excludedSquads' | 'excludedRecruits', ids: string[]) {
    onChange(setOpeningSettings(config, theme, { ...getOpeningSettings(config, theme), [key]: ids }))
  }
  return <section className="settings-panel random-range-settings" aria-label="随机范围设置">
    <div className="panel-heading"><span>01</span><h2>随机范围</h2></div>
    <p className="range-settings-help">完全随机 · 各主题独立保存，修改后自动生效。请排除尚未解锁或不想使用的选项；排除当前结果会清空并解锁该项。干员范围仍在「干员库」中管理。</p>
    <p className="range-settings-help">以下为效果摘要；局外强化、难度附加效果和局内随机结果以游戏为准。工具不代替游戏生成随机职业券或分队附加效果。</p>
    {IS_THEMES.map(theme => {
      const data = getThemeOpening(theme.id), settings = getOpeningSettings(config, theme.id)
      const groups = [
        { title: '分队', options: data.squads, key: 'excludedSquads' as const },
        { title: '招募组合', options: data.recruits, key: 'excludedRecruits' as const },
      ]
      return <details className="range-theme-group" key={theme.id}>
        <summary><strong>{theme.name}</strong><span>{data.squads.length - settings.excludedSquads.length}/{data.squads.length} 分队 · {data.recruits.length - settings.excludedRecruits.length}/{data.recruits.length} 组合</span></summary>
        <div role="region" aria-label={`${theme.name}随机范围`}>
          <p className="range-settings-help">规则核对：{data.checkedAt}{data.updating ? ' · 主题仍在更新，后续内容需核对补充' : ''}</p>
          {groups.map(g => <details className="range-settings-group" key={g.key}>
            <summary>{g.title}<span>已启用 {g.options.length - settings[g.key].length} / {g.options.length}</span></summary>
            <div className="range-settings-actions"><button onClick={() => exclude(theme.id, g.key, [])}>全部启用</button><button onClick={() => exclude(theme.id, g.key, g.options.map(o => o.id))}>全部排除</button></div>
            {g.options.map(o => <label className="range-settings-option" key={o.id}><input type="checkbox" checked={!settings[g.key].includes(o.id)} onChange={e => exclude(theme.id, g.key, e.target.checked ? settings[g.key].filter(id => id !== o.id) : [...settings[g.key], o.id])}/><span><strong>{o.name}</strong><small>{o.effect}</small>{o.unlock && <small>解锁：{o.unlock}</small>}</span></label>)}
          </details>)}
          <a className="range-theme-source" href={data.source} target="_blank" rel="noreferrer">规则来源：PRTS · {theme.name}</a>
        </div>
      </details>
    })}
  </section>
}
