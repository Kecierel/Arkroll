import { useState } from 'react'
import { PROFESSIONS, type InstantRun, type LocalConfig, type Operator } from '../types'
import { IS_THEMES, isISThemeId } from '../data/themes'
import { getThemeOpening } from '../data/openings'
import {
  blankInstantRun, confirmInstant, drawInstant, drawInstantOpening,
  instantHasProgress, instantPool, revokeInstantRecruit, selectInstantProfession,
} from '../core/instant'
import { eligibleFor } from '../core/operatorPool'
import { getOpeningSettings } from '../core/opening'
import { trainingLabel } from '../core/training'
import { finishInstantRun } from '../core/history'
import ProfessionIcon from './ProfessionIcon'
import OperatorAvatar from './OperatorAvatar'
import './instantRandomizer.css'

type Props = {
  config: LocalConfig
  operators: Operator[]
  onChange: (config: LocalConfig) => boolean
}

export default function InstantRandomizer({ config, operators, onChange }: Props) {
  const run = config.instantRun ?? blankInstantRun(config.selectedTheme)
  const [message, setMessage] = useState('')
  const stage = run.stage
  const opening = stage === 'opening'
  const started = run.recruits.length > 0
  const selected = opening ? run.openingProfessions : run.journeyProfessions
  const pool = instantPool(run, stage, operators, config)
  const pending = operators.find(o => o.id === (opening ? run.openingPending : run.journeyPending))
  const pendingValid = !!pending && pool.some(o => o.id === pending.id) && !(opening && started)
  const data = getThemeOpening(run.theme)
  const settings = getOpeningSettings(config, run.theme)
  const recruited = new Set(run.recruits.map(row => row.operator.id))

  function commit(next: LocalConfig, success = '') {
    const saved = onChange(next)
    setMessage(saved ? success : '无法写入本地存储，刷新可能丢失当前进度，请检查浏览器存储权限。')
  }

  function save(next: InstantRun, success = '') {
    commit({ ...config, instantRun: next }, success)
  }

  function act(action: () => InstantRun, success = '') {
    try {
      save(action(), success)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作失败，请重试。')
    }
  }

  function endRun() {
    if (!window.confirm('结束本局会重置本局进度，有已确认招募时自动保存一条整局历史。确定结束？')) return
    commit(finishInstantRun(config, run), run.recruits.length ? '本局已结束，整局记录已保存到历史。' : '本局已结束，可以重新选择职业开局。')
  }

  function changeTheme(theme: InstantRun['theme']) {
    if (instantHasProgress(run) && !window.confirm('切换主题会结束本局并重置进度，有已确认招募时自动保存一条整局历史。确定继续？')) return
    commit(finishInstantRun(config, run, theme), run.recruits.length ? '本局记录已保存到历史，主题已切换。' : '主题已切换。')
  }

  const groups = [
    { field: 'squad' as const, toggle: 'randomSquad' as const, title: '分队', options: data.squads, excluded: settings.excludedSquads },
    { field: 'recruit' as const, toggle: 'randomRecruit' as const, title: '招募组合', options: data.recruits, excluded: settings.excludedRecruits },
  ]

  return <div className="instant-randomizer">
    <div className="instant-run-bar">
      <div className="random-theme">
        <label htmlFor="instant-theme">集成战略主题</label>
        <select id="instant-theme" value={run.theme} onChange={e => {
          if (isISThemeId(e.target.value)) changeTheme(e.target.value)
        }}>
          {IS_THEMES.map(theme => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
        </select>
      </div>
      {instantHasProgress(run) && <button className="instant-end-run" onClick={endRun}>结束本局</button>}
    </div>
    <p className="instant-help">本局刷新后保留 · 已确认招募 {run.recruits.length} 名 · 切换主题会结束本局</p>

    <div className="mode-tabs preset-options instant-stages" role="group" aria-label="即时随机阶段">
      <button aria-pressed={opening} disabled={started} onClick={() => save({ ...run, stage: 'opening' })}>
        <strong>随机开局</strong>
        <small>{started ? '本局已招募，重新开局请先结束本局' : '按实际开局职业券选择干员'}</small>
      </button>
      <button aria-pressed={!opening} onClick={() => save({ ...run, stage: 'journey' })}>
        <strong>途中随机</strong>
        <small>可直接使用，按当前招募券选择职业</small>
      </button>
    </div>

    {opening && <section className="instant-opening" aria-label="开局随机配置">
      <div className="setup-heading"><span>开局配置</span><small>OPENING</small></div>
      <p className="instant-help">分队与招募组合均可选。范围沿用设置页当前主题配置，职业券请按游戏实际结果手选。</p>
      <div className="opening-results">
        {groups.map(group => {
          const option = group.options.find(o => o.id === run[group.field] && !group.excluded.includes(o.id))
          return <section className="opening-result" key={group.field} aria-label={`即时随机${group.title}`}>
            <div className="opening-result-top">
              <label>
                <input type="checkbox" checked={run[group.toggle]} onChange={e => save({
                  ...run, [group.toggle]: e.target.checked, [group.field]: null,
                })}/>
                随机{group.title}
              </label>
              <small>候选 {group.options.length - group.excluded.length}</small>
            </div>
            {run[group.toggle] ? <>
              <h2>{option?.name ?? '尚未抽取'}</h2>
              <p>{option?.effect ?? `按需随机${group.title}，之后手选开局职业。`}</p>
              <div className="card-actions">
                <button onClick={() => act(() => drawInstantOpening(run, group.field, config))}>
                  {option ? '重抽' : '抽取'}{group.title}
                </button>
              </div>
            </> : <p className="instant-off">由你在游戏中自行选择。</p>}
          </section>
        })}
      </div>
      <p className="instant-help">主题规则核对 {data.checkedAt}{data.updating ? ' · 主题仍在更新' : ''}</p>
    </section>}

    {!opening && (run.squad || run.recruit) && <div className="instant-opening-summary" aria-label="本局开局配置">
      {groups.map(group => {
        const option = group.options.find(o => o.id === run[group.field])
        return option && <span key={group.field}>{group.title} · {option.name}</span>
      })}
    </div>}

    <section className="instant-selection" aria-label={opening ? '开局职业选择' : '途中职业选择'}>
      <div className="random-section-title">
        <div>
          <span className="section-kicker">{opening ? 'OPENING RECRUITMENT' : 'ON THE JOURNEY'}</span>
          <h2>{opening ? '选择开局职业' : '选择当前招募券职业'}</h2>
        </div>
        <span>已选 {selected.length} / 8</span>
      </div>
      <p className="instant-help">
        {opening ? '开局通常选择三个职业，也可按实际券选择1至8个。' : '希望足够且准备招募六星时，选择当前可用的1至8个职业。'}
        所选职业的所有可用六星等概率抽取。
      </p>
      <div className="instant-professions" role="group" aria-label="招募职业">
        {PROFESSIONS.map(profession => {
          const count = eligibleFor(profession, operators, config.operatorStates).filter(o => !recruited.has(o.id)).length
          return <button key={profession} aria-pressed={selected.includes(profession)}
            onClick={() => save(selectInstantProfession(run, stage, profession))}>
            <ProfessionIcon profession={profession}/>
            <strong>{profession}</strong>
            <small>候选 {count}</small>
          </button>
        })}
      </div>
      <p className="instant-help">当前候选 {pool.length} 名 · 已确认招募的干员自动排除 · 抽取资格沿用干员库“启用”设置</p>
      <div className="random-controls">
        <div className="random-primary-actions">
          <button className="random-primary" onClick={() => act(() => drawInstant(run, stage, operators, config))}>
            {pending ? '重新抽取' : opening ? '随机开局干员' : '随机一名六星'}
          </button>
        </div>
      </div>
      {(!selected.length || !pool.length) && <p className="instant-hint">
        {!selected.length ? '请先选择至少一个职业。' : '所选职业暂无可招募六星，请调整职业或干员库，本局已招募干员会自动排除。'}
      </p>}
      <div role="status" aria-live="polite" className="instant-message">{message}</div>

      {pending && <section className="single-result instant-pending" aria-label="待确认招募干员">
        <OperatorAvatar operator={pending} profession={pending.profession} size="card"/>
        <div className="single-result-content">
          <span className="eyebrow">待确认招募 / 6★</span>
          <h2>{pending.name}</h2>
          <p className="profession-label single-profession"><ProfessionIcon profession={pending.profession}/>{pending.profession}</p>
          {config.operatorStates[pending.id]?.owned && <p className="result-training">{trainingLabel(config.operatorTraining?.[pending.id])}</p>}
        </div>
        <div className="single-result-actions instant-pending-actions">
          <button className="instant-confirm" disabled={!pendingValid} onClick={() => act(
            () => confirmInstant(run, stage, operators, config), '已记录招募，职业选择已清空，后续抽取自动排除。',
          )}>已招募</button>
          <button onClick={() => save(
            { ...run, [opening ? 'openingPending' : 'journeyPending']: null },
            '已放弃候选，该干员仍可参与后续抽取。',
          )}>放弃候选</button>
        </div>
        <p className="single-result-note">{pendingValid ? '游戏内招募后点击“已招募”加入本局排除名单。重抽可能再次抽中同一名。' : '该干员当前已失效，请重新抽取。'}</p>
      </section>}
    </section>

    <section className="instant-records" aria-label="本局已招募记录">
      <div className="random-section-title">
        <div><span className="section-kicker">THIS RUN</span><h2>本局已招募</h2></div>
        <span>{run.recruits.length} 名</span>
      </div>
      <p className="instant-help">仅记录在网站确认的招募，可逐条撤回，撤回后该干员重新参与候选。结束本局或切换主题时，有已确认招募的局会自动保存一条历史。</p>
      {run.recruits.length ? <ol>
        {run.recruits.map(row => <li key={row.operator.id}>
          <OperatorAvatar operator={row.operator} profession={row.operator.profession} size="list"/>
          <div>
            <strong>{row.operator.name}</strong>
            <small>{row.stage === 'opening' ? '开局' : '途中'} · {row.operator.profession} · {new Date(row.createdAt).toLocaleString('zh-CN')}</small>
          </div>
          <button className="instant-revoke" aria-label={`撤回${row.operator.name}招募`} onClick={() => save(
            revokeInstantRecruit(run, row.operator.id), `已撤回${row.operator.name}，后续抽取按当前启用状态重新参与。`,
          )}>撤回</button>
        </li>)}
      </ol> : <p className="instant-help">尚未确认招募干员。</p>}
    </section>
  </div>
}
