import type { Point } from 'geojson'

const EARTH_RADIUS_METERS = 6_371_000

const radians = (degrees: number): number => (degrees * Math.PI) / 180

/**
 * The distance in meters between two GeoJSON points (the haversine formula). GeoJSON coordinates are
 * [longitude, latitude]: mixing them up puts a robot in another country.
 */
export function distanceInMeters(a: Point, b: Point): number {
  const [lonA, latA] = a.coordinates as [number, number]
  const [lonB, latB] = b.coordinates as [number, number]
  const dLat = radians(latB - latA)
  const dLon = radians(lonB - lonA)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(latA)) * Math.cos(radians(latB)) * Math.sin(dLon / 2) ** 2
  return Math.round(2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h))))
}
