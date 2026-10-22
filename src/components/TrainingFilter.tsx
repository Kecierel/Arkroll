import { useState } from 'react'
import type { LocalConfig, Operator, TrainingThreshold } from '../types'
import { applyTraining, previewConfigTraining, thresholdLabel, type TrainingPreview } from '../core/training'
import './maaImport.css'

export function ThresholdSelect({ value, onChange }: { value: TrainingThreshold; onChange: (value: TrainingThreshold) => void }) {
  return <label className="training-select">练度要求 <select aria-label="练度要求" value={value} onChange={e => onChange(Number(e.target.value) as TrainingThreshold)}><option value={0}>无要求</option><option value={1}>精二1级</option><option value={60}>精二60级</option></select></label>
}
export function TrainingSummary({ preview, threshold }: { preview: TrainingPreview; threshold: TrainingThreshold }) {
  if (threshold === 0) return <><p>要求：无要求 · 启用 {preview.enabledCount} 名</p><p>将覆盖手动启用选择：已拥有者启用，未拥有者禁用。练度未知或未养成不影响启用，练度记录保留；确认后仍可手动调整。</p></>
  return <><p>要求：{thresholdLabel(threshold)} · 启用 {preview.enabledCount} 名 · 未达标 {preview.below.length} 名 · 练度未知 {preview.unknown.length} 名</p><details className="training-list" open={preview.below.length > 0}><summary>未达标（{preview.below.length}）</summary><p>{preview.below.map(o => o.name).join('、') || '无'}</p></details><details className="training-list" open={preview.unknown.length > 0}><summary>练度未知（{preview.unknown.length}）</summary><p>{preview.unknown.map(o => o.name).join('、') || '无'}</p></details><p>本次将覆盖全部干员的手动启用选择：已拥有且达标者启用，未达标、练度未知或未拥有者禁用。确认后仍可手动启用。</p></>
}
interface Props { config: LocalConfig; operators: Operator[]; onApply: (next: LocalConfig) => boolean; onNotice: (text: string) => void }
export default function TrainingFilter({ config, operators, onApply, onNotice }: Props) {
  const [open, setOpen] = useState(false)
  const [threshold, setThreshold] = useState<TrainingThreshold>(config.trainingThreshold ?? 0)
  const preview = open ? previewConfigTraining(config, operators, threshold) : null
  return <section className="training-panel" aria-label="干员练度筛选"><div className="training-toolbar"><div><strong>按已保存练度筛选</strong><p className="current-training-requirement">当前练度要求：{thresholdLabel(config.trainingThreshold ?? 0)}</p><p>使用已保存的练度；可手动编辑或从 MAA 导入更新。</p></div><button aria-expanded={open} aria-controls="training-filter-preview" onClick={() => { if (!open) setThreshold(config.trainingThreshold ?? 0); setOpen(!open) }}>{open ? '收起练度筛选' : '预览练度筛选'}</button></div>{preview && <div id="training-filter-preview" className="maa-preview" role="region" aria-label="练度筛选预览"><ThresholdSelect value={threshold} onChange={setThreshold}/><TrainingSummary preview={preview} threshold={threshold}/><p>拥有状态、当前结果、锁定及历史收藏保持不变。</p><div className="maa-preview-actions"><button onClick={() => setOpen(false)}>取消</button><button className="maa-confirm" onClick={() => { const next = applyTraining(config, operators, threshold); if (onApply(next)) { onNotice(`已按${thresholdLabel(threshold)}筛选，启用 ${preview.enabledCount} 名干员。`); setOpen(false) } }}>确认筛选</button></div></div>}</section>
}
