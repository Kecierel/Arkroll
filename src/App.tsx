import { useEffect, useLayoutEffect, useState } from 'react'
import { version } from '../package.json'
import database from './data/operators.json'
import { PROFESSIONS, type LocalConfig, type Operator, type DrawRecord, type OperatorTraining } from './types'
import { loadConfig, saveConfig, defaultConfig } from './core/storage'
import { exportConfig } from './core/configTransfer'
import { parseBackupWithMigration } from './core/legacyBackup'
import OperatorTrainingEditor from './components/OperatorTrainingEditor'
import MaaRestore from './components/MaaRestore'
import TrainingFilter from './components/TrainingFilter'
import { trainingLabel, meetsThreshold, setOperatorTraining } from './core/training'
import MaaImportPanel from './components/MaaImportPanel'
import { restoreModeRecord } from './core/history'
import HistoryPanel from './components/HistoryPanel'
import ProfessionIcon from './components/ProfessionIcon'
import OperatorAvatar from './components/OperatorAvatar'
import RandomizerPage from './components/RandomizerPage'
import RandomRangeSettings from './components/RandomRangeSettings'
import NavigationIcon from './components/NavigationIcon'

const operators = database.operators as Operator[]
type Page = 'draw' | 'pool' | 'history' | 'settings'
const navigation = [
  { id: 'draw', label: '抽取', english: 'RANDOMIZER', number: '01' },
  { id: 'pool', label: '干员库', english: 'OPERATORS', number: '02' },
  { id: 'history', label: '历史与收藏', english: 'ARCHIVE', number: '03' },
  { id: 'settings', label: '设置', english: 'PREFERENCES', number: '04' },
] as const
const initial = loadConfig(operators)

export default function App() {
  const [page, setPage] = useState<Page>('draw')
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [page])
  const [config, setConfig] = useState<LocalConfig>(initial.config)
  const [notification, setNotification] = useState({ id: 0, text: initial.warning ? '本地设置读取失败，已载入默认设置。' : initial.migratedSample ? '旧版 SAMPLE 干员状态已丢弃；已清空本次结果和锁定。' : '' })
  const [closingNotice, setClosingNotice] = useState(false)
  const notice = notification.text
  function setNotice(text: string) { setClosingNotice(false); setNotification(previous => ({ id: previous.id + 1, text })) }
  useEffect(() => {
    if (!notification.text) return
    const timer = window.setTimeout(() => setNotification(previous => ({ ...previous, text: '' })), 2000)
    return () => window.clearTimeout(timer)
  }, [notification])
  useEffect(() => {
    if (!closingNotice) return
    const timer = window.setTimeout(() => setNotice(''), 200)
    return () => window.clearTimeout(timer)
  }, [closingNotice])
  const [search, setSearch] = useState('')

  function update(next: LocalConfig): boolean { setConfig(next); const saved = saveConfig(next); if (!saved) setNotice('无法写入本地存储；请检查浏览器权限或剩余空间。'); return saved }
  function changeTraining(id: string, training?: OperatorTraining): boolean {
    try { if (update(setOperatorTraining(config, id, training))) { setNotice(training ? '练度已保存，可预览并确认筛选。' : '已清除练度记录。'); return true } }
    catch (error) { setNotice(error instanceof Error ? error.message : '练度保存失败。') }
    return false
  }
  function changeState(id: string, field: 'owned' | 'enabled', value: boolean) { update({ ...config, operatorStates: { ...config.operatorStates, [id]: { ...config.operatorStates[id], [field]: value } } }) }
  function changeAll(field: 'owned' | 'enabled', value: boolean) { update({ ...config, operatorStates: Object.fromEntries(operators.map(operator => [operator.id, { ...config.operatorStates[operator.id], [field]: value }])) }) }
  function restore(row: DrawRecord) {
    const restored = restoreModeRecord(row, config, operators)
    const message = restored.invalid.length ? `以下项目不再符合当前范围，将留空：${restored.invalid.join('、')}。确定恢复？` : '确定恢复此记录？将切换到记录对应的模式，并恢复每职业人数；现有对应位置锁定保留，空位解锁。'
    if (!window.confirm(message)) return
    if (update(restored.config)) { setPage('draw'); setNotice(restored.invalid.length ? `已恢复可用项目；${restored.invalid.join('、')}留空。` : '记录已恢复。') }
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
  function clearAll() { if (window.confirm('确定清除全部本地数据？干员拥有、启用状态、练度、要求、锁定、当前结果、历史及收藏都会重置。')) { update(defaultConfig(operators)); setNotice('全部本地数据已清除。') } }

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">跳转到主要内容</a>
    <header className="site-header">
      <div className="brand"><img className="brand-mark" src="/icon.svg?v=dice-1" alt="" width="36" height="36"/><div><strong>ARKROLL<span className="brand-period">.</span></strong><span>集成战略随机工具</span></div></div>
      <div className="app-version" aria-label={`当前版本 v${version}`}><span>当前版本</span><strong>v{version}</strong></div>
      <nav className="top-nav" aria-label="主导航">{navigation.map(item => <button key={item.id} className={page === item.id ? 'active' : ''} aria-current={page === item.id ? 'page' : undefined} onClick={() => setPage(item.id)}><NavigationIcon name={item.id}/><span className="nav-label"><strong>{item.label}</strong><small>{item.english}</small></span><span className="nav-number">{item.number}</span></button>)}</nav>
      <div className="sidebar-bottom"><span className="sidebar-edition">INTEGRATED STRATEGIES</span><strong>集成战略<br/>随机挑战工具。</strong><div><span>LOCAL EDITION</span><span>v{version}</span></div></div>
    </header>
    <div className="workspace-topbar"><span>集成战略 <span className="breadcrumb-divider">/</span> {navigation.find(item => item.id === page)?.label}</span><span className="offline-badge"><i/>本地配置</span></div>
    <main id="main-content" tabIndex={-1}>{notice && config.noticesEnabled !== false && <div key={notification.id} className={`notice${closingNotice ? ' notice-closing' : ''}`} role="status"><span>{notice}</span><button aria-label="关闭提示" onClick={() => setClosingNotice(true)}>×</button></div>}
      {page === 'draw' && <><RandomizerPage config={config} operators={operators} onChange={update} onNotice={setNotice}/><div className="sample-note"><strong>国服6★数据</strong><span>{operators.length} 名干员 · 数据核对日期 {database.updatedAt} · 仅在本机保存个人设置</span></div></>}
      {page === 'pool' && <><div className="page-heading"><div><p className="eyebrow">02 / OPERATOR POOL</p><h1>干员库</h1><p>分别管理拥有状态和抽取资格。</p><p>点击已拥有干员的名字可修改练度；未拥有的干员请先勾选“拥有”。</p></div><div className="search-wrap"><span>⌕</span><input aria-label="搜索干员名称" placeholder="搜索干员名称" value={search} onChange={e => setSearch(e.target.value)}/></div></div><TrainingFilter config={config} operators={operators} onApply={update} onNotice={setNotice}/><div className="bulk-actions"><span>批量操作</span><button onClick={() => changeAll('owned',true)}>全部设为已拥有</button><button onClick={() => changeAll('owned',false)}>全部设为未拥有</button><button onClick={() => changeAll('enabled',true)}>全部启用</button><button onClick={() => changeAll('enabled',false)}>全部禁用</button><MaaRestore config={config} operators={operators} onApply={update} onNotice={setNotice}/></div><div className="pool-grid">{PROFESSIONS.map(profession => { const list = operators.filter(o => o.profession === profession && o.rarity === 6 && o.name.toLowerCase().includes(search.toLowerCase())); return <section className="pool-group" key={profession}><div className="pool-heading"><h2 className="profession-label"><ProfessionIcon profession={profession} variant="large"/>{profession}</h2><span>{list.length} 位干员</span></div>{list.length ? list.map(operator => <div className="operator-row" key={operator.id}><div className="operator-identity"><OperatorAvatar operator={operator} profession={profession} size="list"/><div>{config.operatorStates[operator.id]?.owned ? <OperatorTrainingEditor operator={operator} training={config.operatorTraining?.[operator.id]} onSave={training => changeTraining(operator.id, training)}/> : <strong>{operator.name}</strong>}<small>6★ · {profession}{config.operatorStates[operator.id]?.owned ? ` · ${trainingLabel(config.operatorTraining?.[operator.id])}` : ''}</small>{config.operatorStates[operator.id]?.owned && config.operatorTraining?.[operator.id] && !meetsThreshold(config.operatorTraining[operator.id], config.trainingThreshold ?? 0) && <small className="training-unmet">未达到当前练度要求</small>}</div></div><label><input type="checkbox" checked={config.operatorStates[operator.id]?.owned ?? false} onChange={e => changeState(operator.id,'owned',e.target.checked)}/>拥有</label><label><input type="checkbox" checked={config.operatorStates[operator.id]?.enabled ?? true} onChange={e => changeState(operator.id,'enabled',e.target.checked)}/>启用</label></div>) : <p className="no-search">无匹配干员</p>}</section> })}</div></>}
      {page === 'history' && <HistoryPanel rows={config.history ?? []} onChange={history => update({ ...config, history })} onRestore={restore} onNotice={setNotice}/>}
      {page === 'settings' && <><div className="page-heading"><div><p className="eyebrow">04 / PREFERENCES</p><h1>设置</h1><p>配置仅保存在当前浏览器。<a href="/data-sources.html">数据来源与声明</a></p></div></div><div className="settings-grid"><RandomRangeSettings config={config} onChange={update}/><section className="settings-panel"><div className="panel-heading"><span>02</span><h2>数据管理</h2></div><MaaImportPanel operators={operators} config={config} onApply={update} onNotice={setNotice}/><div className="setting-row"><div><strong>导出设置</strong><small>下载 JSON 备份，包含设置、练度、历史与收藏。</small></div><button onClick={downloadConfig}>导出 JSON ↗</button></div><div className="setting-row"><div><strong>导入设置</strong><small>覆盖设置、练度、历史与收藏；旧备份缺少的记录将清空。</small></div><label className="file-button">导入 JSON<input type="file" accept="application/json,.json" onChange={e => { void importFile(e.target.files?.[0]); e.target.value = '' }}/></label></div><div className="setting-row danger-row"><div><strong>清除全部本地数据</strong><small>重置干员状态、练度、要求、锁定、结果、历史及收藏。</small></div><button onClick={clearAll}>清除数据</button></div></section><section className="settings-panel other-settings"><div className="panel-heading"><span>03</span><h2>其他</h2></div><div className="setting-row"><div><strong>悬浮提示</strong><small>操作提示显示约 2 秒后自动消失。</small></div><button type="button" role="switch" aria-checked={config.noticesEnabled !== false} aria-label="悬浮提示" onClick={() => { setNotice(''); update({ ...config, noticesEnabled: config.noticesEnabled === false }) }}>{config.noticesEnabled !== false ? '已开启 · 点击关闭' : '已关闭 · 点击开启'}</button></div></section></div></>}
    </main>
    <footer><span>ARKROLL / INTEGRATED STRATEGIES</span><a href="/data-sources.html">数据来源与声明 ↗</a><span>非官方工具 · 配置仅存于当前浏览器 · v{version}</span></footer>
    <nav className="bottom-nav" aria-label="移动端导航">{navigation.map(item => <button key={item.id} className={page === item.id ? 'active' : ''} aria-current={page === item.id ? 'page' : undefined} onClick={() => setPage(item.id)}><NavigationIcon name={item.id}/>{item.label}</button>)}</nav>
  </div>
}
