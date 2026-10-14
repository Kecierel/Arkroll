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
})
