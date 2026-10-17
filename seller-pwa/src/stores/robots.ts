import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { PlatformSource, Robot, RobotModel } from '@/api/types'
import useGraphql from '@/composables/useGraphql'
import {
  CREATE_ROBOT,
  REMOVE_ROBOT,
  RESTORE_ROBOT,
  ROBOT,
  ROBOT_BY_CODE,
  ROBOT_MODELS,
  ROBOTS,
  STOCK_ROBOTS,
} from '@/graphql/robots.query'

/** The robots of one company at a time, the robots in the warehouse, and the kinds of robot that we build */
export const useRobotsStore = defineStore('robots', () => {
  const { apolloClient } = useGraphql()
  const items = ref<Robot[]>([])
  const models = ref<RobotModel[]>([])
  const source = ref<PlatformSource>('PLATFORM')

  async function loadModels(): Promise<void> {
    const { data } = await apolloClient.query({ query: ROBOT_MODELS })
    models.value = data.robotModels
  }

  /** The robots of a company; the ones put out of service only when asked for */
  async function load(companyId: string, withDeleted = false): Promise<void> {
    const { data } = await apolloClient.query({ query: ROBOTS, variables: { companyId, withDeleted } })
    items.value = data.robots.items
    source.value = data.robots.source
  }

  /** One robot with its condition (tilt, food inside, lid, temperature, error, place), or null when it does not exist */
  async function find(id: string): Promise<Robot | null> {
    try {
      const { data } = await apolloClient.query({ query: ROBOT, variables: { id } })
      return data.robot
    } catch (error) {
      const code = (error as { graphQLErrors?: { extensions?: { code?: string } }[] }).graphQLErrors?.[0]?.extensions?.code
      if (code === 'NOT_FOUND') return null
      throw error
    }
  }

  /** The robot behind a scanned QR code (or a typed number), or null when we do not know it */
  async function byCode(code: string): Promise<Robot | null> {
    const { data } = await apolloClient.query({ query: ROBOT_BY_CODE, variables: { code } })
    return data.robotByCode
  }

  async function loadStock(): Promise<Robot[]> {
    const { data } = await apolloClient.query({ query: STOCK_ROBOTS })
    return data.stockRobots
  }

  /** Makes a robot and returns it with its key. The key is shown once: it is not kept here. */
  async function create(companyId: string, input: { name: string; modelId: string }) {
    const { data } = await apolloClient.mutate({ mutation: CREATE_ROBOT, variables: { companyId, input } })
    if (!data) throw new Error('No robot came back')
    return data.createRobot
  }

  /** Puts a robot out of service (soft delete): its key stops working, and it can be restored */
  async function remove(id: string): Promise<Robot> {
    const { data } = await apolloClient.mutate({ mutation: REMOVE_ROBOT, variables: { id } })
    if (!data) throw new Error('No robot came back')
    items.value = items.value.filter(robot => robot.id !== id)
    return data.removeRobot
  }

  async function restore(id: string): Promise<Robot> {
    const { data } = await apolloClient.mutate({ mutation: RESTORE_ROBOT, variables: { id } })
    if (!data) throw new Error('No robot came back')
    return data.restoreRobot
  }

  return { items, models, source, loadModels, load, find, byCode, loadStock, create, remove, restore }
})
