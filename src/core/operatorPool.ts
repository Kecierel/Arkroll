import { PROFESSIONS, type Operator, type OperatorStateMap, type Profession, type AppSettings } from '../types'

export function stateFor(id: string, states: OperatorStateMap) { return states[id] ?? { owned: false, enabled: true } }
export function eligibleFor(profession: Profession, operators: Operator[], states: OperatorStateMap, settings: AppSettings): Operator[] {
  return operators.filter(operator => operator.profession === profession && operator.rarity === 6 && stateFor(operator.id, states).enabled && (!settings.ownedOnly || stateFor(operator.id, states).owned))
}
export function emptyProfessions(operators: Operator[], states: OperatorStateMap, settings: AppSettings): Profession[] {
  return PROFESSIONS.filter(profession => eligibleFor(profession, operators, states, settings).length === 0)
}
