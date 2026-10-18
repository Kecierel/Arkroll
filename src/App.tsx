import { useState } from 'react'
import database from './data/operators.json'
import { PROFESSIONS, type LocalConfig, type Operator, type Profession, type DrawRecord } from './types'
import { loadConfig, saveConfig, defaultConfig } from './core/storage'
import { drawAll, redrawOne, lockExistingResults, blankLocks } from './core/randomizer'
import { emptyProfessions } from './core/operatorPool'
import { exportConfig } from './core/configTransfer'
import { parseBackupWithMigration } from './core/legacyBackup'
import MaaImportPanel from './components/MaaImportPanel'
import { captureRecord, trimHistory, restoreRecord, FAVORITE_LIMIT } from './core/history'
import HistoryPanel from './components/HistoryPanel'
import OperatorAvatar from './components/OperatorAvatar'

const operators = database.operators as Operator[]
type Page = 'draw' | 'pool' | 'history' | 'settings'
const initial = loadConfig(operators)
const operatorById = new Map(operators.map(operator => [operator.id, operator]))

export default function App() {
  const [page, setPage] = useState<Page>('draw')
  const [config, setConfig] = useState<LocalConfig>(initial.config)
  const [notice, setNotice] = useState(initial.warning ? '本地设置读取失败，已载入默认设置。' : initial.migratedSample ? '旧版 SAMPLE 干员状态已丢弃；职业锁定已保留。' : '')
  const [search, setSearch] = useState('')

  function update(next: LocalConfig): boolean { setConfig(next); const saved = saveConfig(next); if (!saved) setNotice('无法写入本地存储；请检查浏览器权限或剩余空间。'); return saved }
  function changeState(id: string, field: 'owned' | 'enabled', value: boolean) { update({ ...config, operatorStates: { ...config.operatorStates, [id]: { ...config.operatorStates[id], [field]: value } } }) }
  function changeAll(field: 'owned' | 'enabled', value: boolean) { update({ ...config, operatorStates: Object.fromEntries(operators.map(operator => [operator.id, { ...config.operatorStates[operator.id], [field]: value }])) }) }
  function draw() {
    const missing = emptyProfessions(operators, config.operatorStates)
    if (missing.length) setNotice(`${missing.join('、')}当前没有符合条件的6★干员。请在干员库中启用该职业的干员。`)
    else setNotice('')
    const next = { ...config, currentResult: drawAll(operators, config.operatorStates, config.currentResult, config.locks) }; const row = captureRecord(next, operators); if (row) next.history = trimHistory([row, ...(config.history ?? [])]); update(next)
  }
  function redraw(profession: Profession) {
    if (config.locks[profession]) return
    if (emptyProfessions(operators, config.operatorStates).includes(profession)) setNotice(`${profession}当前没有符合条件的6★干员。请调整干员设置。`)
    else setNotice('')
    update({ ...config, currentResult: redrawOne(profession, operators, config.operatorStates, config.currentResult) })
  }
  function favoriteCurrent() {
    if ((config.history ?? []).filter(r => r.favorite).length >= FAVORITE_LIMIT) { setNotice('收藏已达 100 条上限，请先删除或取消部分收藏。'); return }
    const row = captureRecord(config, operators, true)
    if (!row) { setNotice('请先抽取完整阵容。'); return }
    if (update({ ...config, history: [row, ...(config.history ?? [])] })) setNotice('当前阵容已收藏，可在历史与收藏中添加备注。')
  }
  function restore(row: DrawRecord) {
    const { result, invalid } = restoreRecord(row, config, operators)
    if (!window.confirm(invalid.length ? '以下职业的干员已禁用或不再符合资格，将留空：' + invalid.join('、') + '。确定替换当前结果？' : '确定用此记录替换当前结果？当前职业锁定保持不变。')) return
    if (update({ ...config, currentResult: result })) { setPage('draw'); setNotice(invalid.length ? '已恢复可用职业；以下职业留空：' + invalid.join('、') : '阵容已恢复，当前职业锁定保持不变。') }
  }
  const resultCount = PROFESSIONS.filter(p => config.currentResult[p] !== null).length
  const lockedCount = PROFESSIONS.filter(p => config.locks[p]).length
  const allResultsLocked = PROFESSIONS.every(p => !config.currentResult[p] || config.locks[p])
  function downloadConfig() {
    const blob = new Blob([JSON.stringify(exportConfig(config), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a'); link.href = url; link.download = 'arknights-is-randomizer-backup.json'; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  async function importFile(file?: File) {
    if (!file) return
    try { const imported = parseBackupWithMigration(await file.text(), operators); update(imported.config); setNotice(imported.discardedSample ? '旧版备份已导入：SAMPLE 干员状态与结果无法对应正式干员，已丢弃；其他设置已保留。' : '设置已导入。') }
    catch (error) { setNotice(error instanceof Error ? error.message : '导入文件格式无效。') }
  }
  async function copyResult() {
    if (PROFESSIONS.some(p => !config.currentResult[p])) { setNotice('请先抽取完整阵容。'); return }
    const text = `集成战略6★随机结果\n\n${PROFESSIONS.map(p => `${p}：${operatorById.get(config.currentResult[p]!)?.name ?? ''}`).join('\n')}`
    try { await navigator.clipboard.writeText(text); setNotice('结果已复制。') }
    catch { setNotice('复制失败，请检查浏览器剪贴板权限。') }
  }
  function clearAll() { if (window.confirm('确定清除全部本地数据？干员拥有、启用状态、锁定、当前结果、历史及收藏都会重置。')) { update(defaultConfig(operators)); setNotice('全部本地数据已清除。') } }

  return <div className="app-shell">
    <header className="site-header"><div className="brand"><div className="brand-mark">6★</div><div><strong>集成战略 · 6★随机</strong><span>IS RANDOMIZER / v0.3.2</span></div></div><nav className="top-nav" aria-label="主导航">{([['draw','抽取'],['pool','干员库'],['history','历史与收藏'],['settings','设置']] as const).map(([id,label]) => <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}>{label}</button>)}</nav><span className="offline-badge">● 配置保存在当前浏览器</span></header>
    <main>{notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="关闭提示" onClick={() => setNotice('')}>×</button></div>}
      {page === 'draw' && <><div className="page-heading"><div><p className="eyebrow">01 / RANDOMIZER</p><h1>干员抽取</h1><p>八个职业，各抽取一名6★干员。</p></div><div className="heading-actions"><button className="primary" onClick={draw}>✦ 随机生成阵容</button><button className="secondary" onClick={copyResult}>复制结果</button><button className="secondary" onClick={favoriteCurrent}>☆ 收藏开局</button></div></div>
        <div className="toolbar"><span>仅从干员库中已启用的干员抽取</span><span className="toolbar-hint">锁定的职业在全局抽取时保留当前结果</span></div>
        <div className="result-lock-toolbar" role="group" aria-label="批量锁定结果"><span>已锁定 {lockedCount} / 8 个职业<small>锁定后不可重抽，解锁后可重新抽取</small></span><div><button disabled={!resultCount || allResultsLocked} onClick={() => update({ ...config, locks: lockExistingResults(config.currentResult, config.locks) })}>一键锁定</button><button disabled={!lockedCount} onClick={() => update({ ...config, locks: blankLocks() })}>全部解锁</button></div></div>
        <div className="card-grid">{PROFESSIONS.map((profession, index) => { const id = config.currentResult[profession]; const operator = id ? operatorById.get(id) : undefined; const name = operator?.name; return <section className={`profession-card ${config.locks[profession] ? 'is-locked' : ''}`} key={profession}><div className="card-top"><span className="card-number">{String(index + 1).padStart(2,'0')}</span><span className="card-class">6★ / {profession}</span></div><div className="card-content"><OperatorAvatar operator={operator} profession={profession} size="card"/><div><span className="card-label">{profession}</span><strong className={name ? '' : 'empty-name'}>{name ?? '尚未抽取'}</strong></div></div><div className="card-actions"><button disabled={config.locks[profession]} title={config.locks[profession] ? '请先解锁该职业' : undefined} onClick={() => redraw(profession)}>↻ 重抽</button><button className={config.locks[profession] ? 'lock-on' : ''} aria-pressed={config.locks[profession]} onClick={() => update({ ...config, locks: { ...config.locks, [profession]: !config.locks[profession] } })}>{config.locks[profession] ? '◆ 已锁定' : '◇ 锁定'}</button></div></section> })}</div>
        <div className="sample-note"><strong>国服6★数据</strong><span>{operators.length} 名干员 · 数据核对日期 {database.updatedAt} · 仅在本机保存个人设置</span></div></>}
      {page === 'pool' && <><div className="page-heading"><div><p className="eyebrow">02 / OPERATOR POOL</p><h1>干员库</h1><p>分别管理拥有状态和抽取资格。</p></div><div className="search-wrap"><span>⌕</span><input aria-label="搜索干员名称" placeholder="搜索干员名称" value={search} onChange={e => setSearch(e.target.value)}/></div></div><div className="bulk-actions"><span>批量操作</span><button onClick={() => changeAll('owned',true)}>全部设为已拥有</button><button onClick={() => changeAll('owned',false)}>全部设为未拥有</button><button onClick={() => changeAll('enabled',true)}>全部启用</button><button onClick={() => changeAll('enabled',false)}>全部禁用</button></div><div className="pool-grid">{PROFESSIONS.map(profession => { const list = operators.filter(o => o.profession === profession && o.rarity === 6 && o.name.toLowerCase().includes(search.toLowerCase())); return <section className="pool-group" key={profession}><div className="pool-heading"><h2>{profession}</h2><span>{list.length} 位干员</span></div>{list.length ? list.map(operator => <div className="operator-row" key={operator.id}><div className="operator-identity"><OperatorAvatar operator={operator} profession={profession} size="list"/><div><strong>{operator.name}</strong><small>6★ · {profession}</small></div></div><label><input type="checkbox" checked={config.operatorStates[operator.id]?.owned ?? false} onChange={e => changeState(operator.id,'owned',e.target.checked)}/>拥有</label><label><input type="checkbox" checked={config.operatorStates[operator.id]?.enabled ?? true} onChange={e => changeState(operator.id,'enabled',e.target.checked)}/>启用</label></div>) : <p className="no-search">无匹配干员</p>}</section> })}</div></>}
      {page === 'history' && <HistoryPanel rows={config.history ?? []} onChange={history => update({ ...config, history })} onRestore={restore} onNotice={setNotice}/>}
      {page === 'settings' && <><div className="page-heading"><div><p className="eyebrow">03 / SETTINGS</p><h1>设置</h1><p>配置仅保存在当前浏览器。<a href="/data-sources.html">数据来源与声明</a></p></div></div><div className="settings-grid"><section className="settings-panel"><div className="panel-heading"><span>01</span><h2>数据管理</h2></div><MaaImportPanel operators={operators} config={config} onApply={update} onNotice={setNotice}/><div className="setting-row"><div><strong>导出设置</strong><small>下载 JSON 备份，包含设置、历史与收藏。</small></div><button onClick={downloadConfig}>导出 JSON ↗</button></div><div className="setting-row"><div><strong>导入设置</strong><small>覆盖设置、历史与收藏；旧备份不含历史时会清空记录。</small></div><label className="file-button">导入 JSON<input type="file" accept="application/json,.json" onChange={e => { void importFile(e.target.files?.[0]); e.target.value = '' }}/></label></div><div className="setting-row danger-row"><div><strong>清除全部本地数据</strong><small>重置干员状态、锁定、结果、历史及收藏。</small></div><button onClick={clearAll}>清除数据</button></div></section></div></>}
    </main><footer><a href="/data-sources.html">数据来源与声明</a> <span>·</span> ARKNIGHTS IS RANDOMIZER <span>·</span> v0.3.2 <span>·</span> 个人设置仅存于当前浏览器</footer><nav className="bottom-nav" aria-label="移动端导航">{([['draw','抽取','✦'],['pool','干员库','▦'],['history','历史收藏','☆'],['settings','设置','⚙']] as const).map(([id,label,icon]) => <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}><span>{icon}</span>{label}</button>)}</nav></div>
}

