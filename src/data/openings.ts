import { MIZUKI_SQUADS, SAMI_SQUADS, SARKAZ_SQUADS, SUI_SQUADS, SEABORN_SQUADS, recruitOptions } from './additionalOpenings'
import { DEFAULT_THEME_ID, IS_THEMES, type ISThemeId } from './themes'
import sources from './openingSources.json'
export interface OpeningOption { id: string; name: string; effect: string; unlock?: string }
export const PHANTOM_SQUADS: OpeningOption[] = [
  { id: 'command', name: '指挥分队', effect: '每场战斗获得4点临时目标生命值。', unlock: '初始解锁' },
  { id: 'gathering', name: '集群分队', effect: '可携带干员+2，可同时部署人数+2。', unlock: '通过第三层「故土残躯」' },
  { id: 'logistics', name: '后勤分队', effect: '初始源石锭+20，初始希望+2。', unlock: '累计获得200源石锭' },
  { id: 'spearhead', name: '矛头分队', effect: '初始目标生命值变为1，所有干员攻击力、生命值+15%。', unlock: '剩余10点以上目标生命时完成结局' },
  { id: 'assault', name: '突击战术分队', effect: '招募4星及以上先锋、近卫干员时直接进阶。', unlock: '拥有合计至少5名先锋或近卫干员完成结局' },
  { id: 'fortification', name: '堡垒战术分队', effect: '招募4星及以上重装、辅助干员时直接进阶。', unlock: '拥有合计至少5名重装或辅助干员完成结局' },
  { id: 'ranged', name: '远程战术分队', effect: '招募4星及以上医疗、狙击干员时直接进阶。', unlock: '拥有合计至少5名医疗或狙击干员完成结局' },
  { id: 'destruction', name: '破坏战术分队', effect: '招募4星及以上术师、特种干员时直接进阶。', unlock: '拥有合计至少5名术师或特种干员完成结局' },
  { id: 'research', name: '研究分队', effect: '初始目标生命+2，战斗获得的指挥经验+30%。', unlock: '累计获得1000指挥经验' },
  { id: 'elite', name: '高规格分队', effect: '初始招募额外获得1张随机高级招募券；该券无法使用助战，职业以游戏为准。', unlock: '拥有至少20名干员时完成结局' },
]
export const PHANTOM_RECRUITS: OpeningOption[] = [
  { id: 'first', name: '先手必胜', effect: '先锋、狙击、特种招募券各一张。', unlock: '初始解锁' },
  { id: 'steady', name: '稳扎稳打', effect: '重装、术师、狙击招募券各一张。', unlock: '初始解锁' },
  { id: 'balance', name: '取长补短', effect: '近卫、辅助、医疗招募券各一张。', unlock: '初始解锁' },
  { id: 'random', name: '随心所欲', effect: '职业券以游戏实际结果为准，保证含一张4星临时招募的高级招募券。', unlock: '使用其他招募组合探索一次' },
]

export interface ThemeOpeningData { squads: OpeningOption[]; recruits: OpeningOption[]; checkedAt: string; source: string; sourceRevision: string; updating: boolean }
const squadLists = { phantom: PHANTOM_SQUADS, mizuki: MIZUKI_SQUADS, sami: SAMI_SQUADS, sarkaz: SARKAZ_SQUADS, sui: SUI_SQUADS, seaborn: SEABORN_SQUADS }
export const THEME_OPENINGS = Object.fromEntries(IS_THEMES.map(theme => [theme.id, {
  squads: squadLists[theme.id],
  recruits: theme.id === 'phantom' ? PHANTOM_RECRUITS : recruitOptions(theme.id === 'mizuki' || theme.id === 'sami' ? 4 : 5, theme.id === 'sui' || theme.id === 'seaborn'),
  checkedAt: sources[theme.id].checkedAt, source: `https://prts.wiki/w/${encodeURIComponent(theme.name)}`, sourceRevision: sources[theme.id].revision, updating: theme.id === 'seaborn',
}])) as Record<ISThemeId, ThemeOpeningData>
export const getThemeOpening = (theme: ISThemeId = DEFAULT_THEME_ID): ThemeOpeningData => THEME_OPENINGS[theme]
