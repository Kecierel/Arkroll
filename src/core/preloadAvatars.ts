import avatarImages from '../data/avatarImages.json'

// Warm the same image cache used by result cards and the operator library.
// Start once at app entry; the browser schedules background requests while
// visible result images retain their high fetch priority.
export function preloadAvatars(): void {
  for (const path of new Set(Object.values(avatarImages))) {
    const image = new Image()
    image.decoding = 'async'
    image.fetchPriority = 'low'
    image.src = `${import.meta.env.BASE_URL}${path}`
  }
}
