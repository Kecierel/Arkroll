import { PROFESSIONS, type Operator, type OperatorStateMap, type Profession, type RandomResult, type LocalConfig } from '../types'
import { eligibleFor } from './operatorPool'

export type PickIndex = (length: number) => number
export const randomIndex: PickIndex = length => {
  if (length < 1) throw new RangeError('候选人数必须大于零')
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buffer = new Uint32Array(1)
    const limit = Math.floor(0x100000000 / length) * length
    do { crypto.getRandomValues(buffer) } while (buffer[0] >= limit)
    return buffer[0] % length
  }
  return Math.floor(Math.random() * length)
}
export const blankResult = (): RandomResult => Object.fromEntries(PROFESSIONS.map(p => [p, null])) as RandomResult
export const blankLocks = (): LocalConfig['locks'] => Object.fromEntries(PROFESSIONS.map(p => [p, false])) as LocalConfig['locks']

export function drawAll(operators: Operator[], states: OperatorStateMap, current: RandomResult, locks: LocalConfig['locks'], pick: PickIndex = randomIndex): RandomResult {
  const next = { ...current }
  for (const profession of PROFESSIONS) {
    if (locks[profession] && current[profession] !== null) continue
    const candidates = eligibleFor(profession, operators, states)
    next[profession] = candidates.length ? candidates[pick(candidates.length)].id : null
  }
  return next
}
export function redrawOne(profession: Profession, operators: Operator[], states: OperatorStateMap, current: RandomResult, pick: PickIndex = randomIndex): RandomResult {
  const candidates = eligibleFor(profession, operators, states)
  if (!candidates.length) return { ...current, [profession]: null }
  const alternatives = candidates.filter(candidate => candidate.id !== current[profession])
  const pool = alternatives.length ? alternatives : candidates
  return { ...current, [profession]: pool[pick(pool.length)].id }
}

export function lockExistingResults(current: RandomResult, locks: LocalConfig['locks']): LocalConfig['locks'] {
  return Object.fromEntries(PROFESSIONS.map(p => [p, locks[p] || current[p] !== null])) as LocalConfig['locks']
}
