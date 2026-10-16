import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { PlatformSource, Robot, RobotModel } from '@/api/types'
import useGraphql from '@/composables/useGraphql'
import { CREATE_ROBOT, ROBOT_MODELS, ROBOTS } from '@/graphql/robots.query'

/** The robots of one company at a time, and the kinds of robot that we build */
export const useRobotsStore = defineStore('robots', () => {
  const { apolloClient } = useGraphql()
  const items = ref<Robot[]>([])
  const models = ref<RobotModel[]>([])
  const source = ref<PlatformSource>('PLATFORM')

  async function loadModels(): Promise<void> {
    const { data } = await apolloClient.query({ query: ROBOT_MODELS })
    models.value = data.robotModels
  }

  async function load(companyId: string): Promise<void> {
    const { data } = await apolloClient.query({ query: ROBOTS, variables: { companyId } })
    items.value = data.robots.items
    source.value = data.robots.source
  }

  /** Makes a robot and returns it with its key. The key is shown once: it is not kept here. */
  async function create(companyId: string, input: { name: string; modelId: string }) {
    const { data } = await apolloClient.mutate({ mutation: CREATE_ROBOT, variables: { companyId, input } })
    if (!data) throw new Error('No robot came back')
    return data.createRobot
  }

  return { items, models, source, loadModels, load, create }
})
