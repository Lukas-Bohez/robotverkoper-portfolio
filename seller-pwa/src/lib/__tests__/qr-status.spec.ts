import { describe, expect, it } from 'vitest'
import { parseRobotCode, qrPayload, qrSvg } from '../qr'
import { defectStatusColor, enumKey, isOpenStatus, robotStatusColor, severityColor } from '../status'

describe('QR codes', () => {
  it('reads what a scanner or a person gives, in any notation', () => {
    for (const raw of ['rbt:RBT-000417', 'RBT-000417', ' rbt:rbt-000417 ', 'rbt: RBT-000417']) {
      expect(parseRobotCode(raw)).toBe('RBT-000417')
    }
  })

  it('refuses a code that is not ours', () => {
    for (const raw of ['', 'https://example.com', 'RBT-417', 'RBT-0004170']) expect(parseRobotCode(raw)).toBeNull()
  })

  it('what we print is what we read', () => {
    expect(parseRobotCode(qrPayload('RBT-000212'))).toBe('RBT-000212')
  })

  it('draws an SVG that holds shapes only', () => {
    const svg = qrSvg('rbt:RBT-000212')
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).not.toContain('<script')
  })
})

describe('statuses', () => {
  it('gives every status a colour (and the screens a word next to it)', () => {
    expect(robotStatusColor('ONLINE')).toBe('success')
    expect(robotStatusColor('DEFECT')).toBe('error')
    expect(robotStatusColor('STOCK')).toBe('primary')
    expect(defectStatusColor('OPEN')).toBe('error')
    expect(defectStatusColor('EN_ROUTE')).toBe('primary')
    expect(defectStatusColor('REPLACED')).toBe('success')
    expect(severityColor('HIGH')).toBe('error')
    expect(severityColor('LOW')).toBe('neutral')
  })

  it('knows which defects still need work', () => {
    expect(isOpenStatus('OPEN')).toBe(true)
    expect(isOpenStatus('ON_SITE')).toBe(true)
    expect(isOpenStatus('CLOSED')).toBe(false)
    expect(isOpenStatus('ARCHIVED')).toBe(false)
  })

  it('turns an enum into a translation key', () => {
    expect(enumKey('EN_ROUTE')).toBe('en_route')
  })
})
