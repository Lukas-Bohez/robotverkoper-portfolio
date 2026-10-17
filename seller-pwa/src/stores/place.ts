import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { GeoPointInput } from '@/api/types'
import { NO_PLACE, type PlaceVariables } from '@/graphql/defects.query'
import { toGeoPoint } from '@/lib/defects'

/**
 * Where the technician stands (the browser asks permission). With a place, the API tells how far each defect is
 * ("350 m"); without one, the screens simply do not show distances.
 */
export const usePlaceStore = defineStore('place', () => {
  const point = ref<GeoPointInput | null>(null)
  const denied = ref(false)
  const locating = ref(false)

  /** The variables every defect query needs: the place, or "no distance" */
  const variables = computed<Required<PlaceVariables>>(() =>
    point.value ? { withDistance: true, from: point.value } : NO_PLACE,
  )

  function locate(): Promise<void> {
    if (!('geolocation' in navigator) || locating.value) return Promise.resolve()
    locating.value = true
    return new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(
        position => {
          point.value = toGeoPoint(position.coords.longitude, position.coords.latitude)
          denied.value = false
          locating.value = false
          resolve()
        },
        () => {
          denied.value = true
          locating.value = false
          resolve()
        },
        { enableHighAccuracy: true, maximumAge: 60_000, timeout: 8000 },
      )
    })
  }

  /** For a demo or a test: say where we are */
  function setPoint(next: GeoPointInput | null): void {
    point.value = next
  }

  return { point, denied, locating, variables, locate, setPoint }
})
