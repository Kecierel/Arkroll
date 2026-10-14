import { PROFESSIONS, type Operator, type OperatorStateMap, type Profession } from '../types'

export function stateFor(id: string, states: OperatorStateMap) { return states[id] ?? { owned: false, enabled: true } }
export function eligibleFor(profession: Profession, operators: Operator[], states: OperatorStateMap): Operator[] {
  return operators.filter(operator => operator.profession === profession && operator.rarity === 6 && stateFor(operator.id, states).enabled)
}
export function emptyProfessions(operators: Operator[], states: OperatorStateMap): Profession[] {
  return PROFESSIONS.filter(profession => eligibleFor(profession, operators, states).length === 0)
}
