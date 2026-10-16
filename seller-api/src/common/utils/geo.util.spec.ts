import type { Point } from 'geojson'
import { describe, expect, it } from 'vitest'
import { distanceInMeters } from './geo.util.js'

// GeoJSON order: [longitude, latitude]
const point = (longitude: number, latitude: number): Point => ({ type: 'Point', coordinates: [longitude, latitude] })
const KORTRIJK = point(3.2647, 50.8283)
const GENT = point(3.7248, 51.0543)

describe('distanceInMeters (haversine on GeoJSON points)', () => {
  it('is zero for the same place', () => {
    expect(distanceInMeters(KORTRIJK, KORTRIJK)).toBe(0)
  })

  it('is the same both ways', () => {
    expect(distanceInMeters(KORTRIJK, GENT)).toBe(distanceInMeters(GENT, KORTRIJK))
  })

  it('knows Kortrijk is about 40 km from Gent', () => {
    const km = distanceInMeters(KORTRIJK, GENT) / 1000
    expect(km).toBeGreaterThan(38)
    expect(km).toBeLessThan(43)
  })

  it('measures two neighbours in meters', () => {
    // Marksesteenweg 58 and 60: about 110 meters apart
    const meters = distanceInMeters(point(3.2647, 50.8283), point(3.265, 50.8293))
    expect(meters).toBeGreaterThan(100)
    expect(meters).toBeLessThan(125)
  })

  it('one degree of latitude is about 111 km', () => {
    const km = distanceInMeters(point(3, 50), point(3, 51)) / 1000
    expect(km).toBeGreaterThan(110.5)
    expect(km).toBeLessThan(111.9)
  })

  it('mixing up longitude and latitude puts a robot in another country', () => {
    expect(distanceInMeters(KORTRIJK, point(50.8283, 3.2647))).toBeGreaterThan(1_000_000)
  })

  it('works over the date line and at the poles without a NaN', () => {
    const acrossDateLine = distanceInMeters(point(179.9, 0), point(-179.9, 0))
    expect(acrossDateLine).toBeGreaterThan(20_000)
    expect(acrossDateLine).toBeLessThan(25_000)
    expect(Number.isNaN(distanceInMeters(point(0, 90), point(180, -90)))).toBe(false)
    expect(distanceInMeters(point(0, 0), point(180, 0))).toBeGreaterThan(20_000_000)
  })
})
