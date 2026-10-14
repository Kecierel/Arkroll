import { PROFESSIONS, type LocalConfig, type Operator, type OperatorStateMap } from '../types'

interface MaaOperator { id: string; name: string; rarity: number; own: boolean }
export interface MaaImportPreview {
  ownership: Record<string, boolean>
  matched: number
  totalSixStar: number
  unknownSixStar: number
  missingLocal: number
  gained: number
  lost: number
  unchanged: number
  ownedAfter: number
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Parse the JSON array exported by MAA's Operator Recognition tool. */
export function parseMaaExport(text: string): MaaOperator[] {
  let raw: unknown
  try { raw = JSON.parse(text.replace(/^\uFEFF/, '')) as unknown }
  catch { throw new Error('MAA 文件不是有效的 JSON。') }
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('请选择 MAA“干员识别”导出的 JSON 数组。')
  const seen = new Set<string>()
  const rows: MaaOperator[] = []
  for (const value of raw) {
    if (!isRecord(value) || typeof value.id !== 'string' || !value.id.startsWith('char_') ||
      typeof value.name !== 'string' || !value.name.trim() ||
      typeof value.own !== 'boolean' || !Number.isInteger(value.rarity) ||
      (value.rarity as number) < 1 || (value.rarity as number) > 6) {
      throw new Error('MAA 文件的干员字段格式无效。')
    }
    if (seen.has(value.id)) throw new Error('MAA 文件包含重复的干员 ID。')
    seen.add(value.id)
    rows.push({ id: value.id, name: value.name, rarity: value.rarity as number, own: value.own })
  }
  return rows
}

export function previewMaaImport(text: string, operators: Operator[], states: OperatorStateMap): MaaImportPreview {
  const rows = parseMaaExport(text)
  const byId = new Map(operators.map(operator => [operator.id, operator]))
  const ownership: Record<string, boolean> = {}
  let totalSixStar = 0
  let unknownSixStar = 0
  let gained = 0
  let lost = 0
  let unchanged = 0
  const coveredProfessions = new Set<string>()
  for (const row of rows) {
    if (row.rarity !== 6) continue
    totalSixStar++
    const operator = byId.get(row.id)
    if (!operator) { unknownSixStar++; continue }
    if (row.name !== operator.name || operator.rarity !== 6) throw new Error(`MAA 文件中的 ID 与名称或星级不符：${row.id}`)
    ownership[row.id] = row.own
    coveredProfessions.add(operator.profession)
    const previous = states[row.id]?.owned ?? false
    if (previous === row.own) unchanged++
    else if (row.own) gained++
    else lost++
  }
  const matched = Object.keys(ownership).length
  if (matched === 0 || PROFESSIONS.some(profession => !coveredProfessions.has(profession))) {
    throw new Error('MAA 文件未覆盖八个职业，无法作为完整干员识别结果导入。')
  }
  const missingLocal = operators.length - matched
  const ownedAfter = operators.reduce((count, operator) =>
    count + Number(ownership[operator.id] ?? states[operator.id]?.owned ?? false), 0)
  return { ownership, matched, totalSixStar, unknownSixStar, missingLocal, gained, lost, unchanged, ownedAfter }
}

export function applyMaaImport(preview: MaaImportPreview, config: LocalConfig): LocalConfig {
  const operatorStates = { ...config.operatorStates }
  for (const [id, owned] of Object.entries(preview.ownership)) {
    const previous = operatorStates[id]
    if (!previous) continue
    operatorStates[id] = { ...previous, owned }
  }
  return { ...config, operatorStates }
}
