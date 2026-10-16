import { useState } from 'react'
import type { Operator, Profession } from '../types'
import avatarImages from '../data/avatarImages.json'

const avatarPaths: Readonly<Record<string, string>> = avatarImages

function AvatarImage({ operator, profession, size }: {
  operator?: Operator
  profession: Profession
  size: 'card' | 'list'
}) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const path = operator ? avatarPaths[operator.id] : undefined
  return <span className={`operator-avatar avatar-${size}`} aria-hidden="true" title={failed ? '头像暂不可用' : undefined}>
    {(!loaded || failed) && <span className="avatar-placeholder">{profession.slice(0, 1)}</span>}
    {path && !failed && <img
      src={`${import.meta.env.BASE_URL}${path}`}
      alt="" width={180} height={180}
      loading={size === 'list' ? 'lazy' : 'eager'} decoding="async"
      fetchPriority={size === 'card' ? 'high' : 'auto'}
      className={loaded ? 'avatar-loaded' : ''}
      onLoad={() => setLoaded(true)} onError={() => setFailed(true)}
    />}
  </span>
}

export default function OperatorAvatar(props: {
  operator?: Operator
  profession: Profession
  size: 'card' | 'list'
}) {
  // Remount image state when a redraw changes the operator, including after failure.
  return <AvatarImage key={props.operator?.id ?? 'empty'} {...props} />
}
