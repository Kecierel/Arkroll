import type { LocalConfig, Operator, OperatorTraining, OperatorTrainingMap, TrainingThreshold } from '../types'

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** Six-star stage caps: E0 50, E1 80, E2 90. Invalid OCR data stays unknown. */
export function parseTraining(value: unknown): OperatorTraining | undefined {
  if (!record(value)) return
  const { elite, level } = value
  if ((elite !== 0 && elite !== 1 && elite !== 2) || typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > [50, 80, 90][elite]) return
  return { elite, level }
}
export function normalizeTraining(value: unknown, operators: Operator[]): OperatorTrainingMap {
  const result: OperatorTrainingMap = {}
  if (record(value)) for (const operator of operators) {
    const training = parseTraining(value[operator.id])
    if (training) result[operator.id] = training
  }
  return result
}
export function trainingLabel(training?: OperatorTraining): string {
  return training ? `${['精零', '精一', '精二'][training.elite]}${training.level}级` : '练度未知'
}
export function thresholdLabel(threshold: TrainingThreshold): string { return threshold === 0 ? '无要求' : `精二${threshold}级` }
export function meetsThreshold(training: OperatorTraining, threshold: TrainingThreshold): boolean {
  return threshold === 0 || (training.elite === 2 && training.level >= threshold)
}
export interface TrainingPreview {
  enabled: Record<string, boolean>
  enabledCount: number
  below: Operator[]
  unknown: Operator[]
}
export function previewTraining(operators: Operator[], ownership: Record<string, boolean>, training: OperatorTrainingMap, threshold: TrainingThreshold): TrainingPreview {
  const enabled: Record<string, boolean> = {}, below: Operator[] = [], unknown: Operator[] = []
  for (const operator of operators) {
    enabled[operator.id] = false
    if (!ownership[operator.id]) continue
    if (threshold === 0) { enabled[operator.id] = true; continue }
    const value = parseTraining(training[operator.id])
    if (!value) unknown.push(operator)
    else if (!meetsThreshold(value, threshold)) below.push(operator)
    else enabled[operator.id] = true
  }
  return { enabled, enabledCount: Object.values(enabled).filter(Boolean).length, below, unknown }
}
export function previewConfigTraining(config: LocalConfig, operators: Operator[], threshold: TrainingThreshold): TrainingPreview {
  return previewTraining(operators, Object.fromEntries(operators.map(o => [o.id, config.operatorStates[o.id]?.owned ?? false])), config.operatorTraining ?? {}, threshold)
}
export function applyTraining(config: LocalConfig, operators: Operator[], threshold: TrainingThreshold): LocalConfig {
  const preview = previewConfigTraining(config, operators, threshold)
  return { ...config, trainingThreshold: threshold, operatorStates: Object.fromEntries(Object.entries(config.operatorStates).map(([id, state]) => [id, { ...state, enabled: preview.enabled[id] ?? false }])) }
}

/** Editing training never changes ownership or draw eligibility. Undefined clears a record. */
export function setOperatorTraining(config: LocalConfig, id: string, value: unknown): LocalConfig {
  if (!config.operatorStates[id]?.owned) throw new Error('请先将该干员设为已拥有，再修改练度。')
  const training = value === undefined ? undefined : parseTraining(value)
  if (value !== undefined && !training) throw new Error('练度无效：精零等级1–50、精一1–80、精二1–90，请输入整数。')
  const operatorTraining = { ...config.operatorTraining }
  if (training) operatorTraining[id] = training
  else delete operatorTraining[id]
  return { ...config, operatorTraining }
}
