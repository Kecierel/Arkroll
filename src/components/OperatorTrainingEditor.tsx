import { useEffect, useRef, useState } from 'react'
import type { Operator, OperatorTraining } from '../types'

interface Props { operator: Operator; training?: OperatorTraining; onSave: (training?: OperatorTraining) => boolean }
export default function OperatorTrainingEditor({ operator, training, onSave }: Props) {
  const [open, setOpen] = useState(false)
  const [elite, setElite] = useState<0 | 1 | 2>(0)
  const [level, setLevel] = useState('1')
  const ref = useRef<HTMLDialogElement>(null)
  const maxLevel = [50, 80, 90][elite]
  const valid = level.trim() !== '' && Number.isInteger(Number(level)) && Number(level) >= 1 && Number(level) <= maxLevel
  useEffect(() => { if (open) ref.current?.showModal() }, [open])
  function close() { ref.current?.close(); setOpen(false) }
  return <><strong><button className="operator-name-button" title="点击修改练度" aria-label={`编辑${operator.name}练度`} onClick={() => { setElite(training?.elite ?? 0); setLevel(String(training?.level ?? 1)); setOpen(true) }}>{operator.name}</button></strong>{open && <dialog className="training-dialog" ref={ref} aria-label={`编辑${operator.name}练度`} onCancel={() => setOpen(false)}><form onSubmit={e => { e.preventDefault(); if (valid && onSave({ elite, level: Number(level) })) close() }}><h2>{operator.name} · 编辑练度</h2><p>保存后可预览练度筛选，不会自动改变启用状态。再次导入 MAA 会覆盖手动练度。</p><label>精英阶段<select aria-label="精英阶段" value={elite} onChange={e => setElite(Number(e.target.value) as 0 | 1 | 2)}><option value={0}>精零</option><option value={1}>精一</option><option value={2}>精二</option></select></label><label>等级<input aria-label="等级" type="number" min={1} max={maxLevel} step={1} required value={level} onChange={e => setLevel(e.target.value)}/></label><p>当前阶段允许等级：1–{maxLevel}。{!valid && <span role="alert">请输入范围内的整数等级。</span>}</p><div className="training-dialog-actions">{training && <button type="button" onClick={() => { if (onSave()) close() }}>清除练度</button>}<button type="button" onClick={close}>取消</button><button type="submit" disabled={!valid}>保存练度</button></div></form></dialog>}</>
}
