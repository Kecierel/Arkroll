import { useState } from 'react'
import type { Profession } from '../types'
const names: Record<Profession, string> = {"先锋":"vanguard","近卫":"guard","重装":"defender","狙击":"sniper","术师":"caster","医疗":"medic","辅助":"supporter","特种":"specialist"}
export default function ProfessionIcon({ profession, variant = 'small' }: { profession: Profession; variant?: 'small' | 'large' }) {
  const [failed, setFailed] = useState(false)
  return failed ? <span aria-hidden="true">{profession.slice(0, 1)}</span> : <img className={`profession-icon-image profession-icon-${variant}`} src={`${import.meta.env.BASE_URL}professions/${variant}/${names[profession]}.png`} alt="" aria-hidden="true" onError={() => setFailed(true)} />
}
