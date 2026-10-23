import { PROFESSIONS, type LocalConfig, type Operator, type Profession, type RandomLocks, type RandomResult, type RecruitCount } from '../types'

export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
export const isRecruitCount = (v: unknown): v is RecruitCount => v === 1 || v === 2 || v === 3
export function normalizeLineup(result: unknown, locks: unknown, operators: Operator[], count: RecruitCount, legacy = false, strict = false): { result: RandomResult; locks: RandomLocks } {
  if (strict && result !== undefined && !isRecord(result)) throw new Error('当前结果格式无效。')
  if (strict && locks !== undefined && !isRecord(locks)) throw new Error('锁定状态格式无效。')
  const ids = new Map(operators.filter(o => o.rarity === 6).map(o => [o.id, o]))
  const entries = PROFESSIONS.map(p => {
    const raw = isRecord(result) ? result[p] : undefined
    const rawLocks = isRecord(locks) ? locks[p] : undefined
    if (strict && result !== undefined && (legacy ? raw !== null && typeof raw !== 'string' : !Array.isArray(raw) || raw.length !== count)) throw new Error('当前结果数量或格式无效。')
    if (strict && locks !== undefined && (legacy ? typeof rawLocks !== 'boolean' : !Array.isArray(rawLocks) || rawLocks.length !== count || rawLocks.some(v => typeof v !== 'boolean'))) throw new Error('锁定状态数量或格式无效。')
    const values = legacy ? [raw] : Array.isArray(raw) ? raw : []
    const bits = legacy ? [rawLocks] : Array.isArray(rawLocks) ? rawLocks : []
    const seen = new Set<string>()
    const row = Array.from({ length: count }, (_, i) => {
      const id = values[i]
      const valid = typeof id === 'string' && ids.get(id)?.profession === p && !seen.has(id)
      if (strict && id !== null && !valid && !(id === undefined && result === undefined)) throw new Error(`${p}结果包含无效或重复干员。`)
      if (!valid) return null
      seen.add(id)
      return id
    })
    return [p, row, row.map((id, i) => !!id && bits[i] === true)] as const
  })
  return { result: Object.fromEntries(entries.map(([p, row]) => [p, row])) as RandomResult, locks: Object.fromEntries(entries.map(([p, , bits]) => [p, bits])) as RandomLocks }
}

export function resizeLineup(result: RandomResult, locks: RandomLocks, count: RecruitCount) {
  const next = Object.fromEntries(PROFESSIONS.map(p => [p, Array.from({ length: count }, (_, i) => result[p][i] ?? null)])) as RandomResult
  return { result: next, locks: Object.fromEntries(PROFESSIONS.map(p => [p, next[p].map((id, i) => !!id && !!locks[p][i])])) as RandomLocks }
}

/** Apply the shared count to every saved theme, including inactive sessions. */
export function setRecruitCount(config: LocalConfig, count: RecruitCount): LocalConfig {
  const sessions = config.sessions && Object.fromEntries(Object.entries(config.sessions).map(([key, session]) => [key, { ...session, ...resizeLineup(session.result, session.locks, count) }]))
  const eight = resizeLineup(config.currentResult, config.locks, count)
  return { ...config, recruitCount: count, currentResult: eight.result, locks: eight.locks, ...(sessions ? { sessions } : {}) }
}

export function setSlotLock(locks: RandomLocks, profession: Profession, slot: number, value: boolean): RandomLocks {
  return { ...locks, [profession]: locks[profession].map((locked, i) => i === slot ? value : locked) }
}
