export const PROFESSIONS = ['先锋','近卫','重装','狙击','术师','医疗','辅助','特种'] as const
export type Profession = typeof PROFESSIONS[number]
export interface Operator { id: string; name: string; profession: Profession; rarity: number }
export interface OperatorDatabase { version: number; updatedAt: string; operators: Operator[] }
export interface OperatorUserState { owned: boolean; enabled: boolean }
export type OperatorStateMap = Record<string, OperatorUserState>
export type RandomResult = Record<Profession, string | null>
export interface LocalConfig { configVersion: 1; operatorStates: OperatorStateMap; locks: Record<Profession, boolean>; currentResult: RandomResult }
export interface ExportedConfig extends LocalConfig { exportedAt: string }
