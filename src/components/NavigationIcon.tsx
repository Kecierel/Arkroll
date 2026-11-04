type NavigationIconName = 'draw' | 'pool' | 'history' | 'settings'

const paths: Record<NavigationIconName, string> = {
  draw: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z',
  pool: 'M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M2 21v-2a7 7 0 0 1 14 0v2 M17 5a4 4 0 0 1 0 8 M19 16a5 5 0 0 1 3 5',
  history: 'M4 7V3 M4 7h4 M4 7a9 9 0 1 1-1 9 M12 7v5l3 2',
  settings: 'M4 7h16 M4 17h16 M8 4v6 M16 14v6',
}

export default function NavigationIcon({ name }: { name: NavigationIconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true"><path d={paths[name]} /></svg>
}
