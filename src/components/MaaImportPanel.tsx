import { useRef, useState } from 'react'
import { applyMaaImport, previewMaaImport } from '../core/maaImport'
import type { LocalConfig, Operator, TrainingThreshold } from '../types'
import { ThresholdSelect, TrainingSummary } from './TrainingFilter'
import './maaImport.css'

interface Props {
  operators: Operator[]
  config: LocalConfig
  onApply: (next: LocalConfig) => boolean
  onNotice: (message: string) => void
}
export default function MaaImportPanel({ operators, config, onApply, onNotice }: Props) {
  const [source, setSource] = useState<{ text: string; name: string } | null>(null)
  const [filter, setFilter] = useState(false)
  const [threshold, setThreshold] = useState<TrainingThreshold>(config.trainingThreshold ?? 1)
  const request = useRef(0)
  // Derive from current config so a changed state or threshold cannot leave a stale preview.
  const preview = source ? previewMaaImport(source.text, operators, config.operatorStates, filter ? threshold : undefined) : null
  async function load(file?: File) {
    const token = ++request.current
    setSource(null)
    setFilter(false)
    setThreshold(config.trainingThreshold ?? 1)
    if (!file) return
    if (file.size > 5_000_000) { onNotice('MAA 文件过大，请检查是否选择了干员识别 JSON。'); return }
    try {
      const text = await file.text()
      if (token !== request.current) return
      previewMaaImport(text, operators, config.operatorStates)
      setSource({ text, name: file.name })
      onNotice('已读取 MAA 文件，请核对预览后确认导入。')
    } catch (error) {
      if (token === request.current) onNotice(error instanceof Error ? error.message : 'MAA 文件格式无效。')
    }
  }
  function confirm() {
    if (!source) return
    const current = previewMaaImport(source.text, operators, config.operatorStates, filter ? threshold : undefined)
    const next = { ...applyMaaImport(current, config), trainingThreshold: threshold }
    if (onApply(next)) {
      onNotice(`已覆盖 ${operators.length} 名干员的拥有、启用与练度记录，启用 ${Object.values(next.operatorStates).filter(s => s.enabled).length} 名。`)
      setSource(null)
    }
  }
  return <div className="maa-import">
    <div className="setting-row"><div><strong>从 MAA 导入持有状态与练度</strong><small>选择 MAA“小工具 → 干员识别”导出的 JSON；导入前可预览变化。</small></div><label className="file-button">选择 MAA JSON<input type="file" accept="application/json,.json" onChange={event => { void load(event.target.files?.[0]); event.target.value = '' }}/></label></div>
    {preview && source && <div className="maa-preview" role="region" aria-label="MAA 导入预览"><strong>导入预览 · {source.name}</strong><div className="maa-stats"><span>匹配6★ <b>{preview.matched}</b></span><span>新增拥有 <b>{preview.gained}</b></span><span>取消拥有 <b>{preview.lost}</b></span><span>拥有状态不变 <b>{preview.unchanged}</b></span><span>导入后已拥有 <b>{preview.ownedAfter}</b></span><span>导入后未拥有 <b>{operators.length - preview.ownedAfter}</b></span><span>启用 <b>{preview.filter?.enabledCount ?? preview.ownedAfter}</b></span></div>{(preview.unknownSixStar > 0 || preview.missingLocal > 0) && <p>未匹配 MAA 6★ {preview.unknownSixStar} 名；本工具名单中未出现在文件里的 {preview.missingLocal} 名将统一设为未拥有、未启用。</p>}<div className="training-options"><label><input type="checkbox" checked={filter} onChange={e => setFilter(e.target.checked)}/>排除未达到练度要求的干员</label><ThresholdSelect value={threshold} onChange={setThreshold}/></div>{preview.filter ? <TrainingSummary preview={preview.filter} threshold={threshold}/> : <p>练度筛选未开启。本次将覆盖全部手动选择：已拥有者启用，未拥有或文件未列出者设为未拥有、未启用。</p>}<p>本次同时更新练度记录，缺失或无效的数据记为未知，不沿用旧练度。职业锁定、当前结果和历史收藏保留。</p><div className="maa-preview-actions"><button onClick={() => { request.current++; setSource(null) }}>取消</button><button className="maa-confirm" onClick={confirm}>确认导入</button></div></div>}
  </div>
}
