import { useState } from 'react'
import { PROFESSIONS, type DrawRecord, type RandomDrawRecord } from '../types'
import { FAVORITE_LIMIT, trimHistory, recordText } from '../core/history'
import { MODES } from '../core/sessions'
import { IS_THEMES } from '../data/themes'
import { getThemeOpening } from '../data/openings'
import ProfessionIcon from './ProfessionIcon'
import OperatorAvatar from './OperatorAvatar'

type Props = {
  rows: DrawRecord[]
  onChange: (rows: DrawRecord[]) => void
  onRestore: (row: RandomDrawRecord) => void
  onNotice: (message: string) => void
}

export default function HistoryPanel({ rows, onChange, onRestore, onNotice }: Props) {
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const shown = rows.filter(row => !favoritesOnly || row.favorite)
  function toggle(row: DrawRecord) {
    if (!row.favorite && rows.filter(row => row.favorite).length >= FAVORITE_LIMIT) {
      onNotice('收藏已达 100 条上限。')
      return
    }
    onChange(trimHistory(rows.map(current => current.id === row.id ? { ...current, favorite: !current.favorite } : current)))
  }
  async function copy(row: DrawRecord) {
    const text = `${recordText(row)}\n${new Date(row.createdAt).toLocaleString('zh-CN')}`
    try {
      await navigator.clipboard.writeText(text)
      onNotice('记录已复制。')
    } catch {
      onNotice('复制失败，请检查浏览器剪贴板权限。')
    }
  }
  return <>
    <div className="page-heading">
      <div>
        <p className="eyebrow">03 / HISTORY & FAVORITES</p>
        <h1>抽取历史与开局收藏</h1>
        <p>预先随机与单干员随机的完整抽取自动记录。即时随机在结束本局或切换主题时保存整局记录。</p>
      </div>
      <div className="heading-actions">
        <button onClick={() => {
          if (window.confirm('清理所有未收藏历史？收藏和干员库将保留。')) onChange(rows.filter(row => row.favorite))
        }}>清理未收藏历史</button>
      </div>
    </div>
    <div className="history-tabs">
      <button aria-pressed={!favoritesOnly} onClick={() => setFavoritesOnly(false)}>全部记录 {rows.length}</button>
      <button aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(true)}>☆ 开局收藏 {rows.filter(row => row.favorite).length}</button>
    </div>
    <p className="history-help">未收藏历史最多 30 条，收藏独立保存最多 100 条，JSON 备份包含全部记录。即时随机整局记录保存最终确认名单，支持查看、收藏、备注和复制。恢复阵容记录会切换到对应模式并检查当前资格，恢复人数和有效锁定。</p>
    <div className="history-list">
      {shown.length === 0 ? <div className="history-empty">
        {favoritesOnly ? '还没有收藏。在历史卡片上点击“收藏”即可保留。' : '还没有历史。完成一次完整抽取，或结束有已确认招募的即时随机本局后，会自动保存在这里。'}
      </div> : shown.map(row => <article className="history-card" key={row.id}>
        <div className="history-header">
          <time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleString('zh-CN')}</time>
          <button aria-pressed={row.favorite} onClick={() => toggle(row)}>{row.favorite ? '★ 已收藏' : '☆ 收藏'}</button>
        </div>
        <p className="history-mode">
          {row.mode === 'instant' ? '即时随机 · 整局记录' : MODES.find(mode => mode.id === (row.mode ?? 'eight'))?.name}
          {row.theme ? ` · ${IS_THEMES.find(theme => theme.id === row.theme)?.name}` : ''}
          {row.mode === 'instant' ? ` · 共${row.recruits.length}名` : row.mode !== 'single' && ` · 每职业${row.recruitCount}名`}
        </p>
        {(row.mode === 'full' || row.mode === 'instant') && <div className="history-opening">
          <span>分队 · {getThemeOpening(row.theme).squads.find(option => option.id === row.squad)?.name ?? '未记录'}</span>
          <span>招募组合 · {getThemeOpening(row.theme).recruits.find(option => option.id === row.recruit)?.name ?? '未记录'}</span>
        </div>}
        {row.mode === 'instant' ? <ol className="history-instant-recruits" aria-label="本局招募顺序">
          {row.recruits.map((recruit, index) => <li className="history-operator" key={recruit.operator.id}>
            <span className="history-recruit-number">{String(index + 1).padStart(2, '0')}</span>
            <OperatorAvatar operator={recruit.operator} profession={recruit.operator.profession} size="list"/>
            <span>
              <strong>{recruit.operator.name}</strong>
              <small>{recruit.stage === 'opening' ? '开局' : '途中'} · {recruit.operator.profession}</small>
              <time dateTime={recruit.createdAt}>{new Date(recruit.createdAt).toLocaleString('zh-CN')}</time>
            </span>
          </li>)}
        </ol> : <div className="history-lineup">
          {PROFESSIONS.filter(profession => row.result[profession]?.length).map(profession => <section className="history-profession-row" key={profession} aria-label={`${profession}招募记录`}>
            <h3 className="profession-label history-profession"><ProfessionIcon profession={profession}/>{profession}</h3>
            <div className="history-profession-operators">
              {(row.result[profession] ?? []).map((operator, slot) => <div className="history-operator" key={slot}>
                <OperatorAvatar operator={operator} profession={profession} size="list"/>
                <span>
                  {row.mode !== 'single' && <small>第{slot + 1}次六星招募</small>}
                  <strong>{operator.name}</strong>
                </span>
              </div>)}
            </div>
          </section>)}
        </div>}
        <details><summary>抽取时的规则摘要</summary><p>{row.rules}</p></details>
        <label className="history-note">备注
          <input maxLength={500} placeholder="为这个开局写点备注（最多500字）" value={row.note}
            onChange={event => onChange(rows.map(current => current.id === row.id ? { ...current, note: event.target.value } : current))}/>
        </label>
        <div className="history-actions">
          {row.mode !== 'instant' && <button onClick={() => onRestore(row)}>恢复为当前结果</button>}
          <button onClick={() => void copy(row)}>复制</button>
          <button onClick={() => {
            if (window.confirm(row.favorite ? '确定删除这条收藏？' : '确定删除这条历史？')) onChange(rows.filter(current => current.id !== row.id))
          }}>删除</button>
        </div>
      </article>)}
    </div>
  </>
}
