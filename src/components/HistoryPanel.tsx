import { useState } from 'react'
import { PROFESSIONS, type DrawRecord } from '../types'
import { FAVORITE_LIMIT, trimHistory, recordText } from '../core/history'
import { MODES } from '../core/sessions'
import { IS_THEMES } from '../data/themes'
import { getThemeOpening } from '../data/openings'
import ProfessionIcon from './ProfessionIcon'
import OperatorAvatar from './OperatorAvatar'

export default function HistoryPanel({ rows, onChange, onRestore, onNotice }: { rows: DrawRecord[]; onChange: (rows: DrawRecord[]) => void; onRestore: (row: DrawRecord) => void; onNotice: (message: string) => void }) {
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const shown = rows.filter(r => !favoritesOnly || r.favorite)
  function toggle(row: DrawRecord) {
    if (!row.favorite && rows.filter(r => r.favorite).length >= FAVORITE_LIMIT) { onNotice('收藏已达 100 条上限。'); return }
    onChange(trimHistory(rows.map(r => r.id === row.id ? { ...r, favorite: !r.favorite } : r)))
  }
  async function copy(row: DrawRecord) {
    const text = `${recordText(row)}\n${new Date(row.createdAt).toLocaleString('zh-CN')}`
    try { await navigator.clipboard.writeText(text); onNotice('记录已复制。') } catch { onNotice('复制失败，请检查浏览器剪贴板权限。') }
  }
  return <><div className="page-heading"><div><p className="eyebrow">03 / HISTORY & FAVORITES</p><h1>抽取历史与开局收藏</h1><p>三种模式的完整抽取自动记录；单项重抽后可手动收藏。</p></div><div className="heading-actions"><button onClick={() => { if (window.confirm('清理所有未收藏历史？收藏和干员库将保留。')) onChange(rows.filter(r => r.favorite)) }}>清理未收藏历史</button></div></div>
    <div className="history-tabs"><button aria-pressed={!favoritesOnly} onClick={() => setFavoritesOnly(false)}>全部记录 {rows.length}</button><button aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(true)}>☆ 开局收藏 {rows.filter(r => r.favorite).length}</button></div>
    <p className="history-help">未收藏历史最多 30 条，超出后移除最早记录；收藏独立保存，最多 100 条。JSON 备份包含全部记录。恢复会切换到对应模式并检查当前资格，恢复当次人数，保留对应位置锁定，失效位置留空并解锁。</p>
    <div className="history-list">{shown.length === 0 ? <div className="history-empty">{favoritesOnly ? '还没有收藏。抽到喜欢的阵容后，点击「收藏开局」。' : '还没有历史。完成一次抽取后会自动保存在这里。'}</div> : shown.map(row => <article className="history-card" key={row.id}><div className="history-header"><time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleString('zh-CN')}</time><button aria-pressed={row.favorite} onClick={() => toggle(row)}>{row.favorite ? '★ 已收藏' : '☆ 收藏'}</button></div><p className="history-mode">{MODES.find(m => m.id === (row.mode ?? 'eight'))?.name}{row.theme ? ` · ${IS_THEMES.find(t => t.id === row.theme)?.name}` : ''}{row.mode !== 'single' && ` · 每职业${row.recruitCount}名`}</p>{row.mode === 'full' && <div className="history-opening"><span>分队：{getThemeOpening(row.theme).squads.find(o => o.id === row.squad)?.name}</span><span>组合：{getThemeOpening(row.theme).recruits.find(o => o.id === row.recruit)?.name}</span></div>}<div className="history-lineup">{PROFESSIONS.flatMap(p => (row.result[p] ?? []).map((operator, slot) => <div className="history-operator" key={`${p}-${slot}`}><OperatorAvatar operator={operator} profession={p} size="list"/><span><small className="profession-label history-profession"><ProfessionIcon profession={p}/>{p}{row.mode !== 'single' && ` · 第${slot + 1}次六星招募`}</small><strong>{operator.name}</strong></span></div>))}</div><details><summary>抽取时的规则摘要</summary><p>{row.rules}</p></details><label className="history-note">备注<input maxLength={500} placeholder="为这个开局写点备注（最多500字）" value={row.note} onChange={e => onChange(rows.map(r => r.id === row.id ? { ...r, note: e.target.value } : r))}/></label><div className="history-actions"><button onClick={() => onRestore(row)}>恢复为当前结果</button><button onClick={() => void copy(row)}>复制</button><button onClick={() => { if (window.confirm(row.favorite ? '确定删除这条收藏？' : '确定删除这条历史？')) onChange(rows.filter(r => r.id !== row.id)) }}>删除</button></div></article>)}</div></>
}
