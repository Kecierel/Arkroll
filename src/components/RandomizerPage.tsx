import { PROFESSIONS, type LocalConfig, type Operator, type Profession, type RandomSession } from '../types'
import { DEFAULT_THEME_ID, IS_THEMES, isISThemeId } from '../data/themes'
import { getThemeOpening } from '../data/openings'
import { blankLocks, lockExistingResults, randomIndex, redrawOne } from '../core/randomizer'
import { getOpeningSettings } from '../core/opening'
import { drawSession, getSession, MODES, putSession } from '../core/sessions'
import { captureModeRecord, FAVORITE_LIMIT, recordText, trimHistory } from '../core/history'
import { eligibleFor } from '../core/operatorPool'
import OperatorAvatar from './OperatorAvatar'
import './randomizerPage.css'

export default function RandomizerPage({ config, operators, onChange, onNotice }: { config: LocalConfig; operators: Operator[]; onChange: (config: LocalConfig) => boolean; onNotice: (text: string) => void }) {
  const mode = config.randomMode ?? 'eight', theme = config.selectedTheme ?? DEFAULT_THEME_ID
  const session = getSession(config, mode), settings = getOpeningSettings(config), themeData = getThemeOpening(theme)
  const byId = new Map(operators.map(o => [o.id, o]))
  function save(next: RandomSession) { return onChange(putSession(config, mode, next)) }
  const locked = mode === 'single' ? Number(session.singleLocked) : PROFESSIONS.filter(p => session.locks[p] && session.result[p]).length + (mode === 'full' ? Number(session.squadLocked) + Number(session.recruitLocked) : 0)
  const existing = mode === 'single' ? Number(!!session.single) : PROFESSIONS.filter(p => session.result[p]).length + (mode === 'full' ? Number(!!session.squad) + Number(!!session.recruit) : 0)
  const allLocked = !!existing && locked === existing
  const record = captureModeRecord(config, operators, mode)
  function draw() {
    const { session: next, error } = drawSession(config, mode, operators)
    if (error) { onNotice(error); return }
    if (JSON.stringify(next) === JSON.stringify(session) && allLocked) { onNotice('已有结果均已锁定，请先解锁需要更新的项目。'); return }
    let updated = putSession(config, mode, next)
    const row = captureModeRecord(updated, operators, mode)
    if (row) updated = { ...updated, history: trimHistory([row, ...(config.history ?? [])]) }
    if (onChange(updated)) onNotice(mode === 'single' && next.single === session.single && operators.filter(o => o.rarity === 6 && config.operatorStates[o.id]?.enabled !== false).length === 1 ? '仅有一名候选干员，结果保持不变。' : '已生成结果并记录到历史。')
  }
  function redraw(profession: Profession) {
    if (session.locks[profession] && session.result[profession]) return
    const pool = eligibleFor(profession, operators, config.operatorStates)
    if (!pool.length) { onNotice(`${profession}没有已启用的6★干员，本次保留结果。`); return }
    if (save({ ...session, result: redrawOne(profession, operators, config.operatorStates, session.result) })) onNotice(pool.length === 1 && session.result[profession] === pool[0].id ? `${profession}仅有一名候选干员，结果保持不变。` : '')
  }
  function lockAll(value: boolean) {
    save(mode === 'single' ? { ...session, singleLocked: value && !!session.single } : { ...session, locks: value ? lockExistingResults(session.result, session.locks) : blankLocks(), ...(mode === 'full' ? { squadLocked: value && !!session.squad, recruitLocked: value && !!session.recruit } : {}) })
  }
  async function copy() {
    if (!record) return
    try { await navigator.clipboard.writeText(recordText(record)); onNotice('当前模式结果已复制。') } catch { onNotice('复制失败，请检查浏览器剪贴板权限。') }
  }
  function favorite() {
    if (!record) return
    if ((config.history ?? []).filter(r => r.favorite).length >= FAVORITE_LIMIT) { onNotice('收藏已达100条上限。'); return }
    if (onChange({ ...config, history: [{ ...record, favorite: true }, ...(config.history ?? [])] })) onNotice('当前模式结果已收藏。')
  }
  const openingGroups = [
    { title: '分队', options: themeData.squads, key: 'excludedSquads' as const, field: 'squad' as const, lock: 'squadLocked' as const },
    { title: '招募组合', options: themeData.recruits, key: 'excludedRecruits' as const, field: 'recruit' as const, lock: 'recruitLocked' as const },
  ]
  return <>
    <div className="page-heading random-heading"><div><p className="eyebrow">01 / RANDOMIZER</p><h1>随机挑战</h1><p>选择一种玩法，让下一局多一点未知。</p></div></div>
    <div className="mode-tabs" role="group" aria-label="随机模式">{MODES.map(m => <button key={m.id} aria-pressed={mode === m.id} onClick={() => { if (onChange({ ...config, randomMode: m.id })) onNotice('') }}><strong>{m.name}</strong><small>{m.id === 'full' ? '分队 · 组合 · 全职业' : m.id === 'eight' ? <>每个职业，<span className="mode-detail">各一名6★干员</span></> : <>全候选池，<span className="mode-detail">一名6★干员</span></>}</small></button>)}</div>
    {mode === 'full' && <div className="full-mode-settings"><div className="random-theme"><label htmlFor="is-theme">集成战略主题</label><select id="is-theme" value={theme} onChange={e => { if (isISThemeId(e.target.value)) { if (onChange({ ...config, selectedTheme: e.target.value })) onNotice('') } }}>{IS_THEMES.map(t => <option value={t.id} key={t.id}>{t.name}</option>)}</select></div><p className="theme-data-note">{themeData.updating ? '主题仍在更新 · ' : ''}规则核对：{themeData.checkedAt}</p></div>}
    <>
      <section className="random-controls" aria-label="统一随机操作"><div className="random-primary-actions"><button className="random-primary" onClick={draw} disabled={allLocked && existing === (mode === 'full' ? 10 : mode === 'eight' ? 8 : 1)}>✦ {mode === 'full' ? '随机全部' : mode === 'eight' ? '随机生成阵容' : '随机一名干员'}</button><button onClick={() => lockAll(true)} disabled={!existing || allLocked}>一键锁定</button><button onClick={() => lockAll(false)} disabled={!locked}>全部解锁</button></div><div className="random-secondary-actions"><button disabled={!record} onClick={() => void copy()}>复制结果</button><button disabled={!record} onClick={favorite}>☆ 收藏结果</button></div></section>
      <div className="random-caption"><span>{mode === 'full' ? '分队和招募组合范围可以在设置中修改' : '从干员库已启用的6★干员中抽取'} </span><span>已锁定 {locked} / {mode === 'full' ? 10 : mode === 'eight' ? 8 : 1} 项</span></div>
      {mode === 'full' && <div className="opening-results">{openingGroups.map(g => { const option = g.options.find(o => o.id === session[g.field]); const pool = g.options.filter(o => !settings[g.key].includes(o.id)); return <section className={`opening-result ${session[g.lock] ? 'is-locked' : ''}`} key={g.field} aria-label={`${g.title}结果`}><div className="opening-result-top"><span>{g.title}</span><small>候选 {pool.length} / {g.options.length}</small></div><h2>{option?.name ?? '尚未抽取'}</h2><p>{option?.effect ?? '点击「随机全部」，与八职业干员一起生成。'}</p><div className="card-actions"><button disabled={session[g.lock] || !pool.length} onClick={() => { const others = pool.filter(o => o.id !== session[g.field]); const choices = others.length ? others : pool; if (save({ ...session, [g.field]: choices[randomIndex(choices.length)].id })) onNotice(pool.length === 1 && session[g.field] === pool[0].id ? `${g.title}仅有一个候选，结果保持不变。` : '') }}>↻ 重抽{g.title}</button><button disabled={!option} className={session[g.lock] ? 'lock-on' : ''} aria-pressed={session[g.lock]} onClick={() => save({ ...session, [g.lock]: !session[g.lock] })}>{session[g.lock] ? '◆ 已锁定' : '◇ 锁定'}</button></div></section> })}</div>}
      {mode === 'single' ? <section className={`single-result ${session.singleLocked ? 'is-locked' : ''}`} aria-label="单干员结果">{(() => { const operator = session.single ? byId.get(session.single) : undefined; return <><span className="eyebrow">ONE OPERATOR / 6★</span><OperatorAvatar operator={operator} profession={operator?.profession ?? '先锋'} size="card"/><h2>{operator?.name ?? '等待你的下一次挑战'}</h2><p>{operator ? `6★ · ${operator.profession}` : '从所有已启用的6★干员中随机选择一名'}</p><button disabled={!operator} aria-pressed={session.singleLocked} onClick={() => save({ ...session, singleLocked: !session.singleLocked })}>{session.singleLocked ? '◆ 已锁定' : '◇ 锁定这名干员'}</button></> })()}</section> : <><div className="random-section-title"><h2>{mode === 'full' ? '每职业首选干员' : '八职业阵容'}</h2><span>6★ / {PROFESSIONS.filter(p => session.result[p]).length} / 8</span></div><div className="card-grid">{PROFESSIONS.map((profession, index) => { const id = session.result[profession], operator = id ? byId.get(id) : undefined; return <section className={`profession-card ${session.locks[profession] ? 'is-locked' : ''}`} key={profession} aria-label={`${profession}干员结果`}><div className="card-top"><span className="card-number">{String(index + 1).padStart(2, '0')}</span><span className="card-class">6★ / {profession}</span></div><div className="card-content"><OperatorAvatar operator={operator} profession={profession} size="card"/><div><span className="card-label">{profession}</span><strong className={operator ? '' : 'empty-name'}>{operator?.name ?? '尚未抽取'}</strong></div></div><div className="card-actions"><button disabled={session.locks[profession] && !!id} onClick={() => redraw(profession)}>↻ 重抽</button><button disabled={!id} className={session.locks[profession] ? 'lock-on' : ''} aria-pressed={session.locks[profession]} onClick={() => save({ ...session, locks: { ...session.locks, [profession]: !session.locks[profession] } })}>{session.locks[profession] ? '◆ 已锁定' : '◇ 锁定'}</button></div></section> })}</div></>}
      <p className="random-footnote">完整全局抽取自动记录，单项重抽后可收藏当前结果。切换模式或页面保留本次结果，刷新后重新开始。{mode === 'full' && '初始招募仍以游戏内职业券、希望和临时招募结果为准。'}</p>
    </>

  </>
}
