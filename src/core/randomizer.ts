import { PROFESSIONS, type Operator, type OperatorStateMap, type Profession, type RandomResult, type RandomLocks, type RecruitCount } from '../types'
import { eligibleFor } from './operatorPool'

export type PickIndex = (length: number) => number
export const randomIndex: PickIndex = length => {
  if (length < 1) throw new RangeError('候选数量必须大于零')
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buffer = new Uint32Array(1)
    const limit = Math.floor(0x100000000 / length) * length
    do { crypto.getRandomValues(buffer) } while (buffer[0] >= limit)
    return buffer[0] % length
  }
  return Math.floor(Math.random() * length)
}
export const blankResult = (count: RecruitCount = 1): RandomResult => Object.fromEntries(PROFESSIONS.map(p => [p, Array<string | null>(count).fill(null)])) as RandomResult
export const blankLocks = (count: RecruitCount = 1): RandomLocks => Object.fromEntries(PROFESSIONS.map(p => [p, Array<boolean>(count).fill(false)])) as RandomLocks

/** All validation happens before consuming randomness or changing a result. */
export function lineupShortages(operators: Operator[], states: OperatorStateMap, current: RandomResult, locks: RandomLocks): string[] {
  return PROFESSIONS.flatMap(p => {
    const held = current[p].filter((id, i): id is string => !!id && locks[p][i])
    const available = held.length + eligibleFor(p, operators, states).filter(o => !held.includes(o.id)).length
    return available < current[p].length ? [`${p}可用${available}名，需要${current[p].length}名（差${current[p].length - available}名）`] : []
  })
}
export function drawAll(operators: Operator[], states: OperatorStateMap, current: RandomResult, locks: RandomLocks, pick: PickIndex = randomIndex): RandomResult {
  if (lineupShortages(operators, states, current, locks).length) return current
  return Object.fromEntries(PROFESSIONS.map(p => {
    const held = current[p].filter((id, i): id is string => !!id && locks[p][i])
    const pool = eligibleFor(p, operators, states).filter(o => !held.includes(o.id))
    return [p, current[p].map((id, i) => {
      if (id && locks[p][i]) return id
      return pool.splice(pick(pool.length), 1)[0].id
    })]
  })) as RandomResult
}
export function redrawOne(profession: Profession, operators: Operator[], states: OperatorStateMap, current: RandomResult, pick: PickIndex = randomIndex, slot = 0): RandomResult {
  if (slot < 0 || slot >= current[profession].length) return current
  const others = current[profession].filter((_, i) => i !== slot)
  const candidates = eligibleFor(profession, operators, states).filter(o => !others.includes(o.id))
  const alternatives = candidates.filter(o => o.id !== current[profession][slot])
  const pool = alternatives.length ? alternatives : candidates
  if (!pool.length) return current
  return { ...current, [profession]: current[profession].map((id, i) => i === slot ? pool[pick(pool.length)].id : id) }
}
export function lockExistingResults(current: RandomResult, _locks: RandomLocks): RandomLocks {
  return Object.fromEntries(PROFESSIONS.map(p => [p, current[p].map(id => !!id)])) as RandomLocks
}
