import { useState } from 'react'
import { PROFESSIONS, type DrawRecord } from '../types'
import { FAVORITE_LIMIT, trimHistory } from '../core/history'
import OperatorAvatar from './OperatorAvatar'

export default function HistoryPanel({ rows, onChange, onRestore, onNotice }: { rows: DrawRecord[]; onChange: (rows: DrawRecord[]) => void; onRestore: (row: DrawRecord) => void; onNotice: (message: string) => void }) {
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const shown = rows.filter(r => !favoritesOnly || r.favorite)
  function toggle(row: DrawRecord) {
    if (!row.favorite && rows.filter(r => r.favorite).length >= FAVORITE_LIMIT) { onNotice('收藏已达 100 条上限。'); return }
    onChange(trimHistory(rows.map(r => r.id === row.id ? { ...r, favorite: !r.favorite } : r)))
  }
  async function copy(row: DrawRecord) {
    const text = `集成战略6★随机结果\n${new Date(row.createdAt).toLocaleString('zh-CN')}\n${PROFESSIONS.map(p => `${p}：${row.result[p].name}`).join('\n')}\n规则：${row.rules}${row.note ? `\n备注：${row.note}` : ''}`
    try { await navigator.clipboard.writeText(text); onNotice('记录已复制。') } catch { onNotice('复制失败，请检查浏览器剪贴板权限。') }
  }
  return <><div className="page-heading"><div><p className="eyebrow">03 / HISTORY & FAVORITES</p><h1>抽取历史与开局收藏</h1><p>完整全局抽取自动记录；单职业重抽后可手动收藏。</p></div><div className="heading-actions"><button onClick={() => { if (window.confirm('清理所有未收藏历史？收藏和干员库将保留。')) onChange(rows.filter(r => r.favorite)) }}>清理未收藏历史</button></div></div>
    <div className="history-tabs"><button aria-pressed={!favoritesOnly} onClick={() => setFavoritesOnly(false)}>全部记录 {rows.length}</button><button aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(true)}>☆ 开局收藏 {rows.filter(r => r.favorite).length}</button></div>
    <p className="history-help">未收藏历史最多 30 条，超出后移除最早记录；收藏独立保存，最多 100 条。JSON 备份包含全部记录。恢复会检查当前资格，职业锁定保持不变。</p>
    <div className="history-list">{shown.length === 0 ? <div className="history-empty">{favoritesOnly ? '还没有收藏。抽到喜欢的阵容后，点击「收藏开局」。' : '还没有历史。完成一次八职业抽取后会自动保存在这里。'}</div> : shown.map(row => <article className="history-card" key={row.id}><div className="history-header"><time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleString('zh-CN')}</time><button aria-pressed={row.favorite} onClick={() => toggle(row)}>{row.favorite ? '★ 已收藏' : '☆ 收藏'}</button></div><div className="history-lineup">{PROFESSIONS.map(p => <div className="history-operator" key={p}><OperatorAvatar operator={row.result[p]} profession={p} size="list"/><span><small>{p}</small><strong>{row.result[p].name}</strong></span></div>)}</div><details><summary>抽取时的规则摘要</summary><p>{row.rules}</p></details><label className="history-note">备注<input maxLength={500} placeholder="为这个开局写点备注（最多500字）" value={row.note} onChange={e => onChange(rows.map(r => r.id === row.id ? { ...r, note: e.target.value } : r))}/></label><div className="history-actions"><button onClick={() => onRestore(row)}>恢复为当前结果</button><button onClick={() => void copy(row)}>复制</button><button onClick={() => { if (window.confirm(row.favorite ? '确定删除这条收藏？' : '确定删除这条历史？')) onChange(rows.filter(r => r.id !== row.id)) }}>删除</button></div></article>)}</div></>
}
