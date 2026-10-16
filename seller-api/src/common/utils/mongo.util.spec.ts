import { describe, expect, it } from 'vitest'
import { toObjectId, toObjectIds } from './mongo.util.js'

describe('ids', () => {
  const valid = '6ad2716ae9f2d7582114b74c'

  it('turns a valid id into an ObjectId and back', () => {
    expect(toObjectId(valid).toHexString()).toBe(valid)
  })

  it('refuses text that is not an id with a 400 and a stable code (not a crash)', () => {
    expect(() => toObjectId('niet-een-id')).toThrow(expect.objectContaining({ code: 'invalid_id' }))
    expect(() => toObjectId('')).toThrow(expect.objectContaining({ code: 'invalid_id' }))
  })

  it('leaves out ids that cannot exist', () => {
    expect(toObjectIds([valid, 'x', ''])).toHaveLength(1)
    expect(toObjectIds([])).toEqual([])
  })
})
