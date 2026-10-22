import type { LocalConfig, MaaSnapshot, Operator, OperatorStateMap, OperatorTrainingMap } from '../types'
import { applyTraining, normalizeTraining } from './training'

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
export function captureMaaSnapshot(operatorStates: OperatorStateMap, operatorTraining: OperatorTrainingMap): MaaSnapshot {
  return { operatorStates: Object.fromEntries(Object.entries(operatorStates).map(([id, state]) => [id, { ...state }])), operatorTraining: Object.fromEntries(Object.entries(operatorTraining).map(([id, training]) => [id, { ...training }])) }
}
export function normalizeMaaSnapshot(value: unknown, operators: Operator[]): MaaSnapshot | undefined {
  if (!record(value) || !record(value.operatorStates)) return
  const operatorStates: OperatorStateMap = {}
  for (const operator of operators) {
    const state = value.operatorStates[operator.id]
    if (state === undefined) continue
    if (!record(state) || typeof state.owned !== 'boolean' || typeof state.enabled !== 'boolean' || (!state.owned && state.enabled)) return
    operatorStates[operator.id] = { owned: state.owned, enabled: state.enabled }
  }
  if (!Object.keys(operatorStates).length) return
  const operatorTraining = normalizeTraining(value.operatorTraining, operators)
  for (const id of Object.keys(operatorTraining)) if (!operatorStates[id]?.owned) delete operatorTraining[id]
  return { operatorStates, operatorTraining }
}
export function restoreMaaSnapshot(config: LocalConfig, operators: Operator[]): LocalConfig {
  const snapshot = normalizeMaaSnapshot(config.maaSnapshot, operators)
  if (!snapshot) throw new Error('暂无可用的 MAA 配置，请先在设置中重新导入并确认 MAA 文件。')
  const restored: LocalConfig = { ...config, operatorStates: Object.fromEntries(operators.map(o => [o.id, { owned: snapshot.operatorStates[o.id]?.owned ?? false, enabled: false }])) }
  return applyTraining(restored, operators, config.trainingThreshold ?? 0)
}
