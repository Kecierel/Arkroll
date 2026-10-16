import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'

describe('published default avatar assets', () => {
  it('covers the current six-star database with exact full IDs and verified source bytes', () => {
    const directory = new URL('../public/avatars/', import.meta.url)
    const database = JSON.parse(readFileSync(new URL('../src/data/operators.json', import.meta.url), 'utf8'))
    const manifest = JSON.parse(readFileSync(new URL('avatar-manifest.json', directory), 'utf8'))
    const operators = database.operators.filter(operator => operator.rarity === 6)
    const expectedIds = operators.map(operator => operator.id).sort()
    expect(manifest.files.map(file => file.id).sort()).toEqual(expectedIds)
    expect(readdirSync(directory).filter(name => name.endsWith('.png')).sort()).toEqual(expectedIds.map(id => `${id}.png`).sort())
    for (const operator of operators) {
      const record = manifest.files.find(file => file.id === operator.id)
      const bytes = readFileSync(new URL(`${operator.id}.png`, directory))
      expect(record.name).toBe(operator.name)
      expect(record.path).toBe(`avatar/${operator.id}.png`)
      expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
      expect(bytes.length).toBe(record.bytes)
      expect(bytes.readUInt32BE(16)).toBe(record.width)
      expect(bytes.readUInt32BE(20)).toBe(record.height)
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(record.sha256)
      expect(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')).toBe(record.blobSha)
    }
  })

  it('ships an exact WebP mapping with valid content hashes and smaller total size', () => {
    const directory = new URL('../public/avatars/', import.meta.url)
    const database = JSON.parse(readFileSync(new URL('../src/data/operators.json', import.meta.url), 'utf8'))
    const paths = JSON.parse(readFileSync(new URL('../src/data/avatarImages.json', import.meta.url), 'utf8'))
    const manifest = JSON.parse(readFileSync(new URL('webp-manifest.json', directory), 'utf8'))
    const source = JSON.parse(readFileSync(new URL('avatar-manifest.json', directory), 'utf8'))
    const ids = database.operators.filter(operator => operator.rarity === 6).map(operator => operator.id).sort()
    expect(Object.keys(paths).sort()).toEqual(ids)
    expect(manifest.files.map(file => file.id).sort()).toEqual(ids)
    expect(readdirSync(new URL('webp/', directory)).sort()).toEqual(manifest.files.map(file => file.path.split('/').at(-1)).sort())
    let optimizedBytes = 0
    for (const file of manifest.files) {
      expect(paths[file.id]).toBe(file.path)
      const bytes = readFileSync(new URL(`../public/${file.path}`, import.meta.url))
      const hash = createHash('sha256').update(bytes).digest('hex')
      expect(bytes.toString('ascii', 0, 4)).toBe('RIFF')
      expect(bytes.toString('ascii', 8, 12)).toBe('WEBP')
      expect(bytes.readUInt32LE(4) + 8).toBe(bytes.length)
      expect(hash).toBe(file.sha256)
      expect(file.path).toBe(`avatars/webp/${file.id}.${hash.slice(0, 12)}.webp`)
      expect(file.sourceSha256).toBe(source.files.find(original => original.id === file.id).sha256)
      expect(file.bytes).toBe(bytes.length)
      optimizedBytes += bytes.length
    }
    expect(optimizedBytes).toBe(manifest.optimizedBytes)
    expect(manifest.originalBytes).toBe(source.files.reduce((sum, file) => sum + file.bytes, 0))
    expect(optimizedBytes).toBeLessThan(manifest.originalBytes * 0.4)
  })
})
