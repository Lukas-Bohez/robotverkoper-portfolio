import { describe, expect, it } from 'vitest'
import { formatSerial, nextSerial, parseRobotCode, qrPayload } from './robot-serial.js'

describe('robot numbers (the text of the QR code)', () => {
  it('writes the number with six digits', () => {
    expect(formatSerial(1)).toBe('RBT-000001')
    expect(formatSerial(417)).toBe('RBT-000417')
    expect(formatSerial(1234567)).toBe('RBT-1234567')
  })

  it('takes the number after the highest one, so a gap is never filled twice', () => {
    expect(nextSerial([])).toBe('RBT-000001')
    expect(nextSerial(['RBT-000001', 'RBT-000002'])).toBe('RBT-000003')
    expect(nextSerial(['RBT-000001', 'RBT-000040'])).toBe('RBT-000041')
    expect(nextSerial(['RBT-000040', 'RBT-000002'])).toBe('RBT-000041')
  })

  it('ignores anything that is not one of our numbers', () => {
    expect(nextSerial(['abc', 'RBT-12', 'RBT-000007', ''])).toBe('RBT-000008')
  })

  it('writes the QR payload with rbt: in front', () => {
    expect(qrPayload('RBT-000417')).toBe('rbt:RBT-000417')
  })

  describe('parseRobotCode: what a scanner reads or a person types', () => {
    it.each(['rbt:RBT-000417', 'RBT-000417', 'rbt:rbt-000417', ' rbt: RBT-000417 ', '  rbt-000417'])('reads %j', code => {
      expect(parseRobotCode(code)).toBe('RBT-000417')
    })

    it.each(['', 'https://example.com', 'RBT-417', 'RBT-0004170', 'rbt:', 'robot-000417', 'rbt:RBT-000417x'])(
      'refuses %j with invalid_robot_code',
      code => {
        expect(() => parseRobotCode(code)).toThrow(expect.objectContaining({ code: 'invalid_robot_code' }))
      },
    )

    it('what qrPayload makes is what parseRobotCode reads', () => {
      expect(parseRobotCode(qrPayload(formatSerial(212)))).toBe('RBT-000212')
    })
  })
})
