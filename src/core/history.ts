import { PROFESSIONS, type DrawRecord, type LocalConfig, type Operator } from '../types'
import { blankResult } from './randomizer'
import { eligibleFor } from './operatorPool'

export const HISTORY_LIMIT = 30
export const FAVORITE_LIMIT = 100
export function normalizeHistory(value: unknown): DrawRecord[] {
  if (!Array.isArray(value)) throw new Error('历史记录格式无效。')
  const ids = new Set<string>()
  const rows = value.map((row: DrawRecord) => {
    if (!row || typeof row.id !== 'string' || !row.id || ids.has(row.id) || typeof row.createdAt !== 'string' || !Number.isFinite(Date.parse(row.createdAt)) || typeof row.rules !== 'string' || row.rules.length > 2000 || typeof row.note !== 'string' || row.note.length > 500 || typeof row.favorite !== 'boolean' || !row.result || PROFESSIONS.some(p => { const o = row.result[p]; return !o || typeof o.id !== 'string' || typeof o.name !== 'string' || o.profession !== p || o.rarity !== 6 })) throw new Error('历史记录格式无效。')
    ids.add(row.id)
    return { id: row.id, createdAt: row.createdAt, rules: row.rules, note: row.note, favorite: row.favorite, result: Object.fromEntries(PROFESSIONS.map(p => [p, { ...row.result[p] }])) } as DrawRecord
  })
  if (rows.filter(r => r.favorite).length > FAVORITE_LIMIT) throw new Error('历史或收藏超过保存上限。')
  return trimHistory(rows)
}
export function captureRecord(config: LocalConfig, operators: Operator[], favorite = false): DrawRecord | null {
  const result = {} as DrawRecord['result']
  for (const p of PROFESSIONS) {
    const operator = operators.find(o => o.id === config.currentResult[p] && o.profession === p && o.rarity === 6)
    if (!operator) return null
    result[p] = { ...operator }
  }
  return { id: crypto.randomUUID(), createdAt: new Date().toISOString(), result, favorite, note: '', rules: `仅启用的6★干员；${PROFESSIONS.map(p => `${p}候选${eligibleFor(p, operators, config.operatorStates).length}人${config.locks[p] ? '（锁定）' : ''}`).join('、')}` }
}
export function trimHistory(rows: DrawRecord[]): DrawRecord[] {
  let count = 0
  return rows.filter(row => row.favorite || ++count <= HISTORY_LIMIT)
}
export function restoreRecord(row: DrawRecord, config: LocalConfig, operators: Operator[]) {
  const result = blankResult()
  const invalid = PROFESSIONS.filter(p => {
    const valid = eligibleFor(p, operators, config.operatorStates).some(o => o.id === row.result[p].id)
    if (valid) result[p] = row.result[p].id
    return !valid
  })
  return { result, invalid }
}
