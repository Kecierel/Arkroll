import { useState } from 'react'
import type { LocalConfig, Operator } from '../types'
import { normalizeMaaSnapshot, restoreMaaSnapshot } from '../core/maaSnapshot'
import { thresholdLabel } from '../core/training'

interface Props { config: LocalConfig; operators: Operator[]; onApply: (next: LocalConfig) => boolean; onNotice: (text: string) => void }
export default function MaaRestore({ config, operators, onApply, onNotice }: Props) {
  const [open, setOpen] = useState(false)
  const snapshot = normalizeMaaSnapshot(config.maaSnapshot, operators)
  const next = open && snapshot ? restoreMaaSnapshot(config, operators) : null
  const changed = next ? operators.filter(o => {
    const before = config.operatorStates[o.id], after = next.operatorStates[o.id]
    return before?.owned !== after.owned || before?.enabled !== after.enabled
  }) : []
  return <><button onClick={() => { if (!snapshot) { onNotice('暂无可用的 MAA 配置，请先在设置中重新导入并确认 MAA 文件。'); return } setOpen(!open) }} aria-expanded={open} aria-controls="maa-restore-preview">使用MAA配置</button>{next && <div id="maa-restore-preview" className="maa-preview maa-restore-preview" role="region" aria-label="MAA 配置恢复预览"><strong>使用 MAA 拥有状态，按当前练度要求筛选</strong><p>拥有状态将以最近一次确认导入的 MAA 配置为准，保留当前练度，并按当前要求（{thresholdLabel(config.trainingThreshold ?? 0)}）重新计算启用状态：{(config.trainingThreshold ?? 0) === 0 ? '已拥有者启用（包含练度未知者），未拥有者禁用。' : '已拥有且达标者启用，未达标、练度未知或未拥有者禁用。'}当前练度要求、结果、锁定及历史收藏保留。</p><div className="maa-stats"><span>恢复后拥有 <b>{Object.values(next.operatorStates).filter(s => s.owned).length}</b></span><span>恢复后启用 <b>{Object.values(next.operatorStates).filter(s => s.enabled).length}</b></span><span>将改变 <b>{changed.length}</b> 名</span></div><details className="training-list"><summary>将改变的干员（{changed.length}）</summary><p>{changed.map(o => o.name).join('、') || '无'}</p></details><p>快照没有记录的干员将设为未拥有、未启用，已有练度记录保留。此操作不会修改 MAA 快照。</p><div className="maa-preview-actions"><button onClick={() => setOpen(false)}>取消</button><button className="maa-confirm" onClick={() => { if (onApply(restoreMaaSnapshot(config, operators))) { setOpen(false); onNotice('已使用 MAA 拥有状态，并按当前练度要求重新筛选；练度记录保留。') } }}>确认恢复</button></div></div>}</>
}
