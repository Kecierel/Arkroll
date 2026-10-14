import { useState } from 'react'
import database from './data/operators.json'
import { PROFESSIONS, type LocalConfig, type Operator, type Profession } from './types'
import { loadConfig, saveConfig, defaultConfig } from './core/storage'
import { drawAll, redrawOne } from './core/randomizer'
import { emptyProfessions } from './core/operatorPool'
import { exportConfig } from './core/configTransfer'
import { parseBackupWithMigration } from './core/legacyBackup'
import MaaImportPanel from './components/MaaImportPanel'

const operators = database.operators as Operator[]
type Page = 'draw' | 'pool' | 'settings'
const initial = loadConfig(operators)
const operatorById = new Map(operators.map(operator => [operator.id, operator]))

export default function App() {
  const [page, setPage] = useState<Page>('draw')
  const [config, setConfig] = useState<LocalConfig>(initial.config)
  const [notice, setNotice] = useState(initial.warning ? '本地设置读取失败，已载入默认设置。' : initial.migratedSample ? '旧版 SAMPLE 干员状态已丢弃；抽取设置与职业锁定已保留。' : '')
  const [search, setSearch] = useState('')

  function update(next: LocalConfig): boolean { setConfig(next); const saved = saveConfig(next); if (!saved) setNotice('无法写入本地存储；请检查浏览器权限或剩余空间。'); return saved }
  function changeState(id: string, field: 'owned' | 'enabled', value: boolean) { update({ ...config, operatorStates: { ...config.operatorStates, [id]: { ...config.operatorStates[id], [field]: value } } }) }
  function changeAll(field: 'owned' | 'enabled', value: boolean) { update({ ...config, operatorStates: Object.fromEntries(operators.map(operator => [operator.id, { ...config.operatorStates[operator.id], [field]: value }])) }) }
  function draw() {
    const missing = emptyProfessions(operators, config.operatorStates, config.settings)
    if (missing.length) setNotice(`${missing.join('、')}当前没有符合条件的六星干员。请调整“仅抽取已拥有的干员”或干员启用状态。`)
    else setNotice('')
    update({ ...config, currentResult: drawAll(operators, config.operatorStates, config.settings, config.currentResult, config.locks) })
  }
  function redraw(profession: Profession) {
    if (emptyProfessions(operators, config.operatorStates, config.settings).includes(profession)) setNotice(`${profession}当前没有符合条件的六星干员。请调整干员设置。`)
    else setNotice('')
    update({ ...config, currentResult: redrawOne(profession, operators, config.operatorStates, config.settings, config.currentResult) })
  }
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
    const text = `集成战略六星随机结果\n\n${PROFESSIONS.map(p => `${p}：${operatorById.get(config.currentResult[p]!)?.name ?? ''}`).join('\n')}`
    try { await navigator.clipboard.writeText(text); setNotice('结果已复制。') }
    catch { setNotice('复制失败，请检查浏览器剪贴板权限。') }
  }
  function resetSettings() { update({ ...config, settings: { ownedOnly: false } }); setNotice('普通设置已恢复默认值。') }
  function clearAll() { if (window.confirm('确定清除全部本地数据？干员拥有、启用状态及当前结果都会重置。')) { update(defaultConfig(operators)); setNotice('全部本地数据已清除。') } }

  return <div className="app-shell">
    <header className="site-header"><div className="brand"><div className="brand-mark">六</div><div><strong>集成战略 · 六星随机</strong><span>IS RANDOMIZER / v0.2.2</span></div></div><nav className="top-nav" aria-label="主导航">{([['draw','抽取'],['pool','干员库'],['settings','设置']] as const).map(([id,label]) => <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}>{label}</button>)}</nav><span className="offline-badge">● 配置保存在当前浏览器</span></header>
    <main>{notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="关闭提示" onClick={() => setNotice('')}>×</button></div>}
      {page === 'draw' && <><div className="page-heading"><div><p className="eyebrow">01 / RANDOMIZER</p><h1>干员抽取</h1><p>八个职业，各抽取一名六星干员。</p></div><div className="heading-actions"><button className="primary" onClick={draw}>✦ 随机生成阵容</button><button className="secondary" onClick={copyResult}>复制结果</button></div></div>
        <div className="toolbar"><label className="checkline"><input type="checkbox" checked={config.settings.ownedOnly} onChange={e => update({ ...config, settings: { ownedOnly: e.target.checked } })}/><span className="switch-ui"/>仅抽取已拥有的干员</label><span className="toolbar-hint">锁定的职业在全局抽取时保留当前结果</span></div>
        <div className="card-grid">{PROFESSIONS.map((profession, index) => { const id = config.currentResult[profession]; const name = id ? operatorById.get(id)?.name : null; return <section className={`profession-card ${config.locks[profession] ? 'is-locked' : ''}`} key={profession}><div className="card-top"><span className="card-number">{String(index + 1).padStart(2,'0')}</span><span className="card-class">六星 / {profession}</span></div><div className="card-content"><div className="profession-icon">{profession.slice(0,1)}</div><div><span className="card-label">{profession}</span><strong className={name ? '' : 'empty-name'}>{name ?? '尚未抽取'}</strong></div></div><div className="card-actions"><button onClick={() => redraw(profession)}>↻ 重抽</button><button className={config.locks[profession] ? 'lock-on' : ''} aria-pressed={config.locks[profession]} onClick={() => update({ ...config, locks: { ...config.locks, [profession]: !config.locks[profession] } })}>{config.locks[profession] ? '◆ 已锁定' : '◇ 锁定'}</button></div></section> })}</div>
        <div className="sample-note"><strong>国服六星数据</strong><span>{operators.length} 名干员 · 数据核对日期 {database.updatedAt} · 仅在本机保存个人设置</span></div></>}
      {page === 'pool' && <><div className="page-heading"><div><p className="eyebrow">02 / OPERATOR POOL</p><h1>干员库</h1><p>分别管理拥有状态和抽取资格。</p></div><div className="search-wrap"><span>⌕</span><input aria-label="搜索干员名称" placeholder="搜索干员名称" value={search} onChange={e => setSearch(e.target.value)}/></div></div><div className="bulk-actions"><span>批量操作</span><button onClick={() => changeAll('owned',true)}>全部设为已拥有</button><button onClick={() => changeAll('owned',false)}>全部设为未拥有</button><button onClick={() => changeAll('enabled',true)}>全部启用</button><button onClick={() => changeAll('enabled',false)}>全部禁用</button></div><div className="pool-grid">{PROFESSIONS.map(profession => { const list = operators.filter(o => o.profession === profession && o.rarity === 6 && o.name.toLowerCase().includes(search.toLowerCase())); return <section className="pool-group" key={profession}><div className="pool-heading"><h2>{profession}</h2><span>{list.length} 位干员</span></div>{list.length ? list.map(operator => <div className="operator-row" key={operator.id}><div><strong>{operator.name}</strong><small>六星 · {profession}</small></div><label><input type="checkbox" checked={config.operatorStates[operator.id]?.owned ?? false} onChange={e => changeState(operator.id,'owned',e.target.checked)}/>拥有</label><label><input type="checkbox" checked={config.operatorStates[operator.id]?.enabled ?? true} onChange={e => changeState(operator.id,'enabled',e.target.checked)}/>启用</label></div>) : <p className="no-search">无匹配干员</p>}</section> })}</div></>}
      {page === 'settings' && <><div className="page-heading"><div><p className="eyebrow">03 / SETTINGS</p><h1>设置</h1><p>配置仅保存在当前浏览器。<a href="/data-sources.html">数据来源与声明</a></p></div></div><div className="settings-grid"><section className="settings-panel"><div className="panel-heading"><span>01</span><h2>抽取设置</h2></div><label className="settings-toggle"><div><strong>仅抽取已拥有的干员</strong><small>开启后，只从拥有且已启用的干员中抽取。</small></div><input type="checkbox" checked={config.settings.ownedOnly} onChange={e => update({ ...config, settings: { ownedOnly: e.target.checked } })}/></label></section><section className="settings-panel"><div className="panel-heading"><span>02</span><h2>数据管理</h2></div><MaaImportPanel operators={operators} config={config} onApply={update} onNotice={setNotice}/><div className="setting-row"><div><strong>导出设置</strong><small>下载 JSON 备份文件。</small></div><button onClick={downloadConfig}>导出 JSON ↗</button></div><div className="setting-row"><div><strong>导入设置</strong><small>验证文件后覆盖当前本地设置。</small></div><label className="file-button">导入 JSON<input type="file" accept="application/json,.json" onChange={e => { void importFile(e.target.files?.[0]); e.target.value = '' }}/></label></div><div className="setting-row"><div><strong>恢复默认设置</strong><small>只重置抽取设置，保留干员状态和结果。</small></div><button onClick={resetSettings}>恢复默认</button></div><div className="setting-row danger-row"><div><strong>清除全部本地数据</strong><small>重置干员状态、锁定和抽取结果。</small></div><button onClick={clearAll}>清除数据</button></div></section></div></>}
    </main><footer><a href="/data-sources.html">数据来源与声明</a> <span>·</span> ARKNIGHTS IS RANDOMIZER <span>·</span> v0.2.2 <span>·</span> 个人设置仅存于当前浏览器</footer><nav className="bottom-nav" aria-label="移动端导航">{([['draw','抽取','✦'],['pool','干员库','▦'],['settings','设置','⚙']] as const).map(([id,label,icon]) => <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}><span>{icon}</span>{label}</button>)}</nav></div>
}

