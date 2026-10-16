import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Defect } from '@/api/types'
import useGraphql from '@/composables/useGraphql'
import {
  CLOSE_DEFECT,
  DEFECTS,
  REPLACE_ROBOT,
  REPORT_DEFECT,
  type ReportDefectVariables,
} from '@/graphql/defects.query'

/** The open defects of all robots. The realtime refresh is in the screen (a subscription). */
export const useDefectsStore = defineStore('defects', () => {
  const { apolloClient } = useGraphql()
  const items = ref<Defect[]>([])

  async function load(): Promise<void> {
    const { data } = await apolloClient.query({ query: DEFECTS, variables: { onlyOpen: true } })
    items.value = data.defects
  }

  async function report(robotId: string, input: ReportDefectVariables['input']): Promise<Defect> {
    const { data } = await apolloClient.mutate({ mutation: REPORT_DEFECT, variables: { robotId, input } })
    if (!data) throw new Error('No defect came back')
    return data.reportDefect
  }

  async function close(id: string): Promise<Defect> {
    const { data } = await apolloClient.mutate({ mutation: CLOSE_DEFECT, variables: { id } })
    if (!data) throw new Error('No defect came back')
    return data.closeDefect
  }

  /** Replaces the robot of a defect: returns the new robot and its key (shown once) */
  async function replace(defectId: string, name: string) {
    const { data } = await apolloClient.mutate({
      mutation: REPLACE_ROBOT,
      variables: { defectId, input: { name } },
    })
    if (!data) throw new Error('No robot came back')
    return data.replaceRobot
  }

  return { items, load, report, close, replace }
})
