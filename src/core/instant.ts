import { PROFESSIONS, type InstantRecruit, type InstantRun, type InstantStage, type LocalConfig, type Operator, type Profession } from '../types'
import { DEFAULT_THEME_ID, isISThemeId, type ISThemeId } from '../data/themes'
import { getThemeOpening } from '../data/openings'
import { getOpeningSettings } from './opening'
import { eligibleFor } from './operatorPool'
import { isRecord } from './lineup'
import { randomIndex, type PickIndex } from './randomizer'

export function blankInstantRun(theme: ISThemeId = DEFAULT_THEME_ID): InstantRun {
  return {
    theme,
    stage: 'opening',
    randomSquad: false,
    randomRecruit: false,
    squad: null,
    recruit: null,
    openingProfessions: [],
    journeyProfessions: [],
    openingPending: null,
    journeyPending: null,
    recruits: [],
  }
}

export function resetInstantRun(run: InstantRun, theme = run.theme): InstantRun {
  return { ...blankInstantRun(theme), randomSquad: run.randomSquad, randomRecruit: run.randomRecruit }
}

export function instantHasProgress(run: InstantRun): boolean {
  return !!(run.squad || run.recruit || run.openingPending || run.journeyPending || run.recruits.length)
}

export function instantPool(run: InstantRun, stage: InstantStage, operators: Operator[], config: LocalConfig): Operator[] {
  const selected = run[stage === 'opening' ? 'openingProfessions' : 'journeyProfessions']
  const recruited = new Set(run.recruits.map(row => row.operator.id))
  return PROFESSIONS
    .filter(profession => selected.includes(profession))
    .flatMap(profession => eligibleFor(profession, operators, config.operatorStates))
    .filter(operator => !recruited.has(operator.id))
}

export function selectInstantProfession(run: InstantRun, stage: InstantStage, profession: Profession): InstantRun {
  const key = stage === 'opening' ? 'openingProfessions' : 'journeyProfessions'
  const selected = run[key]
  return {
    ...run,
    [key]: selected.includes(profession) ? selected.filter(p => p !== profession) : [...selected, profession],
    [stage === 'opening' ? 'openingPending' : 'journeyPending']: null,
  }
}

export function drawInstant(run: InstantRun, stage: InstantStage, operators: Operator[], config: LocalConfig, pick: PickIndex = randomIndex): InstantRun {
  if (stage === 'opening' && run.recruits.length) throw new Error('本局已有招募记录，随机开局请先结束本局。')
  if (!run[stage === 'opening' ? 'openingProfessions' : 'journeyProfessions'].length) throw new Error('请先选择至少一个职业。')
  const pool = instantPool(run, stage, operators, config)
  if (!pool.length) throw new Error('所选职业没有可招募的6★干员，请调整职业或干员库；本局已招募的干员会自动排除。')
  return { ...run, [stage === 'opening' ? 'openingPending' : 'journeyPending']: pool[pick(pool.length)].id }
}

export function confirmInstant(run: InstantRun, stage: InstantStage, operators: Operator[], config: LocalConfig): InstantRun {
  if (stage === 'opening' && run.recruits.length) throw new Error('本局已有招募记录，随机开局请先结束本局。')
  const id = run[stage === 'opening' ? 'openingPending' : 'journeyPending']
  const operator = instantPool(run, stage, operators, config).find(o => o.id === id)
  if (!operator) throw new Error('待确认干员已失效或已招募，请重新抽取。')
  return {
    ...run,
    stage: 'journey',
    openingProfessions: [],
    journeyProfessions: [],
    openingPending: null,
    journeyPending: null,
    recruits: [...run.recruits, { operator: { ...operator }, stage, createdAt: new Date().toISOString() }],
  }
}

export function revokeInstantRecruit(run: InstantRun, operatorId: string): InstantRun {
  return { ...run, recruits: run.recruits.filter(row => row.operator.id !== operatorId) }
}

export function drawInstantOpening(run: InstantRun, field: 'squad' | 'recruit', config: LocalConfig, pick: PickIndex = randomIndex): InstantRun {
  if (run.recruits.length) throw new Error('本局已有招募记录，随机开局请先结束本局。')
  if (!run[field === 'squad' ? 'randomSquad' : 'randomRecruit']) throw new Error('请先打开对应的随机开关。')
  const data = getThemeOpening(run.theme)
  const settings = getOpeningSettings(config, run.theme)
  const pool = field === 'squad'
    ? data.squads.filter(option => !settings.excludedSquads.includes(option.id))
    : data.recruits.filter(option => !settings.excludedRecruits.includes(option.id))
  if (!pool.length) throw new Error('该项目没有可用候选，请到设置中调整当前主题的随机范围。')
  const alternatives = pool.filter(o => o.id !== run[field])
  const choices = alternatives.length ? alternatives : pool
  return { ...run, [field]: choices[pick(choices.length)].id }
}

export function normalizeInstantRecruits(value: unknown, strict = false): InstantRecruit[] {
  const fail = () => {
    throw new Error('即时随机招募记录格式无效。')
  }
  if (strict && !Array.isArray(value)) fail()
  const recruits: InstantRecruit[] = []
  const seen = new Set<string>()
  for (const row of Array.isArray(value) ? value : []) {
    if (!isRecord(row) || !isRecord(row.operator)) {
      if (strict) fail()
      continue
    }
    const o = row.operator
    const validOperator = typeof o.id === 'string' && o.id.length > 0 && !seen.has(o.id)
      && typeof o.name === 'string' && o.name.length > 0
      && PROFESSIONS.includes(o.profession as Profession) && o.rarity === 6
    const validStage = row.stage === 'journey' || (row.stage === 'opening' && recruits.length === 0)
    const validTime = typeof row.createdAt === 'string' && Number.isFinite(Date.parse(row.createdAt))
    if (!validOperator || !validStage || !validTime) {
      if (strict) fail()
      continue
    }
    seen.add(o.id as string)
    recruits.push({
      operator: { id: o.id as string, name: o.name as string, profession: o.profession as Profession, rarity: 6 },
      stage: row.stage as InstantStage,
      createdAt: row.createdAt as string,
    })
  }
  return recruits
}

export function normalizeInstantRun(value: unknown, operators: Operator[], fallback: ISThemeId = DEFAULT_THEME_ID, strict = false): InstantRun {
  const fail = () => {
    throw new Error('即时随机本局数据格式无效。')
  }
  if (value === undefined) return blankInstantRun(fallback)
  if (!isRecord(value)) {
    if (strict) fail()
    return blankInstantRun(fallback)
  }
  const run = blankInstantRun(isISThemeId(value.theme) ? value.theme : fallback)
  if (strict && (!isISThemeId(value.theme) || (value.stage !== 'opening' && value.stage !== 'journey'))) fail()
  run.stage = value.stage === 'journey' ? 'journey' : 'opening'
  for (const key of ['randomSquad', 'randomRecruit'] as const) {
    if (strict && typeof value[key] !== 'boolean') fail()
    run[key] = value[key] === true
  }
  const data = getThemeOpening(run.theme)
  for (const field of ['squad', 'recruit'] as const) {
    const raw = value[field]
    const choices = field === 'squad' ? data.squads : data.recruits
    if (strict && raw !== null && !choices.some(o => o.id === raw)) fail()
    run[field] = choices.some(o => o.id === raw) ? raw as string : null
  }
  if (!run.randomSquad) run.squad = null
  if (!run.randomRecruit) run.recruit = null
  for (const key of ['openingProfessions', 'journeyProfessions'] as const) {
    const raw = value[key]
    if (strict && (!Array.isArray(raw) || raw.length !== new Set(raw).size || raw.some(p => !PROFESSIONS.includes(p)))) fail()
    run[key] = PROFESSIONS.filter(p => Array.isArray(raw) && raw.includes(p))
  }
  run.recruits = normalizeInstantRecruits(value.recruits, strict)
  const seen = new Set(run.recruits.map(row => row.operator.id))
  for (const stage of ['opening', 'journey'] as const) {
    const key = stage === 'opening' ? 'openingPending' : 'journeyPending'
    const raw = value[key]
    const selected = run[stage === 'opening' ? 'openingProfessions' : 'journeyProfessions']
    const valid = operators.some(operator => operator.id === raw && operator.rarity === 6 && selected.includes(operator.profession))
      && !seen.has(raw as string) && !(stage === 'opening' && run.recruits.length)
    if (strict && raw !== null && !valid) fail()
    run[key] = valid ? raw as string : null
  }
  if (run.recruits.length) run.stage = 'journey'
  return run
}
