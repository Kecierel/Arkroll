export const PROFESSIONS = ['先锋','近卫','重装','狙击','术师','医疗','辅助','特种'] as const
export type Profession = typeof PROFESSIONS[number]
export interface Operator { id: string; name: string; profession: Profession; rarity: number }
export interface OperatorDatabase { version: number; updatedAt: string; operators: Operator[] }
export interface OperatorTraining { elite: 0 | 1 | 2; level: number }
export type TrainingThreshold = 0 | 1 | 60
export type OperatorTrainingMap = Record<string, OperatorTraining>
export interface OperatorUserState { owned: boolean; enabled: boolean }
export type OperatorStateMap = Record<string, OperatorUserState>
export type RandomResult = Record<Profession, string | null>
export type RandomMode = 'full' | 'eight' | 'single'
export interface RandomSession { result: RandomResult; locks: Record<Profession, boolean>; squad: string | null; recruit: string | null; squadLocked: boolean; recruitLocked: boolean; single: string | null; singleLocked: boolean }
export interface DrawRecord { id: string; createdAt: string; result: Partial<Record<Profession, Operator>>; rules: string; favorite: boolean; note: string; mode?: RandomMode; theme?: import('../data/themes').ISThemeId; squad?: string; recruit?: string }
export interface MaaSnapshot { operatorStates: OperatorStateMap; operatorTraining: OperatorTrainingMap }
export interface LocalConfig { maaSnapshot?: MaaSnapshot; configVersion: 1; operatorTraining?: OperatorTrainingMap; trainingThreshold?: TrainingThreshold; noticesEnabled?: boolean; randomMode?: RandomMode; sessions?: Record<string, RandomSession>; themeOpenings?: Partial<Record<import('../data/themes').ISThemeId, import('../core/opening').OpeningSettings>>; phantomOpening?: import('../core/opening').OpeningSettings; selectedTheme?: import('../data/themes').ISThemeId; operatorStates: OperatorStateMap; locks: Record<Profession, boolean>; currentResult: RandomResult; history?: DrawRecord[] }
export interface ExportedConfig extends LocalConfig { exportedAt: string }
