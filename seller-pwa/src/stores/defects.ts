import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Defect, DefectResolution, DefectSeverity, NearbyDefect } from '@/api/types'
import useGraphql from '@/composables/useGraphql'
import {
  ARRIVE_AT_DEFECT,
  CALL_TECHNICIAN,
  CLAIM_DEFECT,
  CLOSE_DEFECT,
  DEFECT,
  DEFECTS,
  NEARBY_DEFECTS,
  RELEASE_DEFECT,
  REMOVE_DEFECT,
  REPLACE_ROBOT,
  REPORT_DEFECT,
  REQUEST_HELP,
  RESTORE_DEFECT,
  UPDATE_DEFECT_CHECKLIST,
  type DefectsVariables,
} from '@/graphql/defects.query'
import { usePlaceStore } from './place'

/**
 * The defects of all robots, and what a technician does with them: take one ("ik ga erheen"), arrive, do the safety
 * check, repair or replace. Every change comes back as the defect itself, and the list follows it. The realtime
 * refresh is in the screen (a subscription).
 */
export const useDefectsStore = defineStore('defects', () => {
  const { apolloClient } = useGraphql()
  const place = usePlaceStore()
  const items = ref<Defect[]>([])

  /** The defects: the open ones by default; resolved, archived and cold ones (per year) only when asked for */
  async function load(filter: Omit<DefectsVariables, 'withDistance' | 'from'> = {}): Promise<void> {
    const { data } = await apolloClient.query({
      query: DEFECTS,
      variables: { onlyOpen: true, ...filter, ...place.variables },
    })
    items.value = data.defects
  }

  /** One defect with everything the detail screens show, or null when it does not exist */
  async function find(id: string): Promise<Defect | null> {
    try {
      const { data } = await apolloClient.query({ query: DEFECT, variables: { id, ...place.variables } })
      return data.defect
    } catch (error) {
      const code = (error as { graphQLErrors?: { extensions?: { code?: string } }[] }).graphQLErrors?.[0]?.extensions?.code
      if (code === 'NOT_FOUND') return null
      throw error
    }
  }

  /** Other defects that are not resolved yet and lie close: the technician is there anyway */
  async function nearby(defectId: string, radiusMeters = 1000): Promise<NearbyDefect[]> {
    const { data } = await apolloClient.query({ query: NEARBY_DEFECTS, variables: { defectId, radiusMeters } })
    return data.nearbyDefects
  }

  /** The list shows the changed defect at once (the API sends the new state back) */
  function applyChange(changed: Defect): Defect {
    const index = items.value.findIndex(defect => defect.id === changed.id)
    if (index >= 0) items.value = items.value.map((defect, i) => (i === index ? changed : defect))
    return changed
  }

  async function report(robotId: string, input: { summary: string; severity: DefectSeverity }): Promise<Defect> {
    const { data } = await apolloClient.mutate({
      mutation: REPORT_DEFECT,
      variables: { robotId, input, ...place.variables },
    })
    if (!data) throw new Error('No defect came back')
    return data.reportDefect
  }

  /** "Ik ga erheen": the technician takes the defect */
  async function claim(id: string): Promise<Defect> {
    const { data } = await apolloClient.mutate({ mutation: CLAIM_DEFECT, variables: { id, ...place.variables } })
    if (!data) throw new Error('No defect came back')
    return applyChange(data.claimDefect)
  }

  /** Gives the defect back, so another technician can take it */
  async function release(id: string): Promise<Defect> {
    const { data } = await apolloClient.mutate({ mutation: RELEASE_DEFECT, variables: { id, ...place.variables } })
    if (!data) throw new Error('No defect came back')
    return applyChange(data.releaseDefect)
  }

  /** "Ik ben ter plaatse" */
  async function arrive(id: string): Promise<Defect> {
    const { data } = await apolloClient.mutate({ mutation: ARRIVE_AT_DEFECT, variables: { id, ...place.variables } })
    if (!data) throw new Error('No defect came back')
    return applyChange(data.arriveAtDefect)
  }

  /** The safety check on site: which items are done */
  async function updateChecklist(id: string, done: string[]): Promise<Defect> {
    const { data } = await apolloClient.mutate({
      mutation: UPDATE_DEFECT_CHECKLIST,
      variables: { id, done, ...place.variables },
    })
    if (!data) throw new Error('No defect came back')
    return applyChange(data.updateDefectChecklist)
  }

  /** Closes a defect: repaired, or a false alarm */
  async function close(
    id: string,
    input: { resolution: Exclude<DefectResolution, 'REPLACED'>; note?: string },
  ): Promise<Defect> {
    const { data } = await apolloClient.mutate({ mutation: CLOSE_DEFECT, variables: { id, input, ...place.variables } })
    if (!data) throw new Error('No defect came back')
    return applyChange(data.closeDefect)
  }

  /**
   * Replaces the robot of a defect. With the QR code of a robot from the warehouse that robot takes the place; without
   * a code a new robot is made. Returns the new robot and its key (shown once).
   */
  async function replace(defectId: string, input: { code?: string; name?: string } = {}) {
    const { data } = await apolloClient.mutate({
      mutation: REPLACE_ROBOT,
      variables: { defectId, input, ...place.variables },
    })
    if (!data) throw new Error('No robot came back')
    applyChange(data.replaceRobot.defect)
    return data.replaceRobot
  }

  /** An administrator calls for a technician (how they are reached does not matter) */
  async function callTechnician(id: string): Promise<Defect> {
    const { data } = await apolloClient.mutate({ mutation: CALL_TECHNICIAN, variables: { id, ...place.variables } })
    if (!data) throw new Error('No defect came back')
    return applyChange(data.callTechnician)
  }

  /** A technician asks a colleague or the administrator for help */
  async function requestHelp(id: string): Promise<Defect> {
    const { data } = await apolloClient.mutate({ mutation: REQUEST_HELP, variables: { id, ...place.variables } })
    if (!data) throw new Error('No defect came back')
    return applyChange(data.requestHelp)
  }

  /** Archives a resolved defect (soft delete) */
  async function remove(id: string): Promise<Defect> {
    const { data } = await apolloClient.mutate({ mutation: REMOVE_DEFECT, variables: { id, ...place.variables } })
    if (!data) throw new Error('No defect came back')
    items.value = items.value.filter(defect => defect.id !== id)
    return data.removeDefect
  }

  async function restore(id: string): Promise<Defect> {
    const { data } = await apolloClient.mutate({ mutation: RESTORE_DEFECT, variables: { id, ...place.variables } })
    if (!data) throw new Error('No defect came back')
    return data.restoreDefect
  }

  return {
    items,
    load,
    find,
    nearby,
    report,
    claim,
    release,
    arrive,
    updateChecklist,
    close,
    replace,
    callTechnician,
    requestHelp,
    remove,
    restore,
  }
})
