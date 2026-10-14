import { useState } from 'react'
import { applyMaaImport, previewMaaImport, type MaaImportPreview } from '../core/maaImport'
import type { LocalConfig, Operator } from '../types'
import './maaImport.css'

interface Props {
  operators: Operator[]
  config: LocalConfig
  onApply: (next: LocalConfig) => boolean
  onNotice: (message: string) => void
}

export default function MaaImportPanel({ operators, config, onApply, onNotice }: Props) {
  const [preview, setPreview] = useState<MaaImportPreview | null>(null)
  const [fileName, setFileName] = useState('')
  async function load(file?: File) {
    setPreview(null)
    if (!file) return
    if (file.size > 5_000_000) { onNotice('MAA 文件过大，请检查是否选择了干员识别 JSON。'); return }
    try {
      const next = previewMaaImport(await file.text(), operators, config.operatorStates)
      setPreview(next)
      setFileName(file.name)
      onNotice('已读取 MAA 文件，请核对预览后确认导入。')
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'MAA 文件格式无效。')
    }
  }
  function confirm() {
    if (!preview) return
    if (onApply(applyMaaImport(preview, config))) onNotice(`已更新 ${preview.matched} 名六星干员的拥有状态；未拥有的干员已自动禁用，已拥有干员的启用选择及其他设置保留。`)
    setPreview(null)
  }
  return <div className="maa-import">
    <div className="setting-row"><div><strong>从 MAA 导入持有状态</strong><small>选择 MAA“小工具 → 干员识别”导出的 JSON；导入前可预览变化。</small></div><label className="file-button">选择 MAA JSON<input type="file" accept="application/json,.json" onChange={event => { void load(event.target.files?.[0]); event.target.value = '' }}/></label></div>
    {preview && <div className="maa-preview" role="region" aria-label="MAA 导入预览"><strong>导入预览 · {fileName}</strong><div className="maa-stats"><span>匹配六星 <b>{preview.matched}</b></span><span>新增拥有 <b>{preview.gained}</b></span><span>取消拥有 <b>{preview.lost}</b></span><span>保持不变 <b>{preview.unchanged}</b></span><span>导入后已拥有 <b>{preview.ownedAfter}</b></span><span>导入后未拥有 <b>{operators.length - preview.ownedAfter}</b></span></div>{(preview.unknownSixStar > 0 || preview.missingLocal > 0) && <p>未匹配 MAA 六星 {preview.unknownSixStar} 名；本工具名单中未出现在文件里的 {preview.missingLocal} 名将保留原拥有状态，导入后仍未拥有的会自动禁用。</p>}<p>更新匹配干员的“拥有”状态，并自动禁用导入后所有未拥有的干员；已拥有干员的启用选择、锁定、设置和当前结果保留。</p><div className="maa-preview-actions"><button onClick={() => setPreview(null)}>取消</button><button className="maa-confirm" onClick={confirm}>确认导入</button></div></div>}
  </div>
}
