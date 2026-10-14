// Run deliberately when updating the public operator list; never during a site build.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const repository = 'yuanyan3060/ArknightsGameResource'
const revision = '9bf239661e37766fba585806fb9fa67e79bb679e'
const root = new URL('../', import.meta.url)
const database = JSON.parse(await readFile(new URL('src/data/operators.json', root), 'utf8'))
async function request(url) {
  let lastError
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(25000) })
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`)
      return Buffer.from(await response.arrayBuffer())
    } catch (error) { lastError = error }
  }
  throw lastError
}
const tree = JSON.parse((await request(`https://api.github.com/repos/${repository}/git/trees/${revision}?recursive=1`)).toString())
if (tree.truncated) throw new Error('Incomplete upstream tree')
const files = new Map(tree.tree.map(file => [file.path, file]))
const destination = new URL('public/avatars/', root)
await mkdir(destination, { recursive: true })
const manifest = { repository, revision, downloadedAt: new Date().toISOString().slice(0, 10), variant: 'default (elite 0)', files: [] }
let completed = 0
// Exact full-ID matching excludes elite-2 and skin variants without damaging alter IDs.
const pending = database.operators.filter(operator => operator.rarity === 6)
await Promise.all(Array.from({ length: 4 }, async () => {
  while (pending.length) {
    const operator = pending.shift()
    if (!/^char_[a-zA-Z0-9_]+$/.test(operator.id)) throw new Error(`Invalid ID: ${operator.id}`)
    const path = `avatar/${operator.id}.png`
    const expected = files.get(path)
    if (!expected || expected.type !== 'blob') throw new Error(`Missing default avatar: ${path}`)
    const target = new URL(`${operator.id}.png`, destination)
    let image
    try { image = await readFile(target) } catch { /* not downloaded yet */ }
    const blobSha = buffer => createHash('sha1').update(`blob ${buffer.length}\0`).update(buffer).digest('hex')
    if (!image || blobSha(image) !== expected.sha) {
      // GitHub raw may be unreachable on some networks; the mirror is still hash-checked.
      try {
        const response = await fetch(`https://raw.githubusercontent.com/${repository}/${revision}/${path}`, { signal: AbortSignal.timeout(5000) })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        image = Buffer.from(await response.arrayBuffer())
      } catch {
        image = await request(`https://gcore.jsdelivr.net/gh/${repository}@${revision}/${path}`)
      }
      if (blobSha(image) !== expected.sha) throw new Error(`Upstream hash mismatch: ${path}`)
      await writeFile(target, image)
    }
    if (!image.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) throw new Error(`Not PNG: ${path}`)
    manifest.files.push({ id: operator.id, name: operator.name, path, bytes: image.length, width: image.readUInt32BE(16), height: image.readUInt32BE(20), blobSha: expected.sha, sha256: createHash('sha256').update(image).digest('hex') })
    if (++completed % 20 === 0) console.log(`${completed} avatars verified`)
  }
}))
manifest.files.sort((a, b) => a.id.localeCompare(b.id))
await writeFile(new URL('avatar-manifest.json', destination), JSON.stringify(manifest, null, 2) + '\n')
// Preserve upstream text without assigning its code license to game artwork.
const license = JSON.parse((await request(`https://api.github.com/repos/${repository}/contents/LICENSE?ref=${revision}`)).toString())
await writeFile(new URL('public/licenses/ArknightsGameResource-AGPL-3.0.txt', root), Buffer.from(license.content, 'base64'))
console.log(JSON.stringify({ count: manifest.files.length, bytes: manifest.files.reduce((sum, file) => sum + file.bytes, 0), dimensions: [...new Set(manifest.files.map(file => `${file.width}x${file.height}`))] }))
