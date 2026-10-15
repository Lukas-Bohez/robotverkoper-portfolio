import type { PlatformGateway } from './platform.ts'
import type { SellerService } from './service.ts'
import type { RobotModel, SellerStore } from './store.ts'

/** What we build and sell: our own catalogue (no link with the models of the platform) */
export const ROBOT_MODELS: RobotModel[] = [
  {
    id: 'model-food',
    name: 'Delivery Bot Eten',
    kind: 'FOOD',
    description: 'Bezorgrobot met verwarmd of gekoeld vak voor warme en koude gerechten',
  },
  {
    id: 'model-parcel',
    name: 'Delivery Bot Pakket',
    kind: 'PARCEL',
    description: 'Bezorgrobot met een gewoon vak voor pakketten en kleine bestellingen',
  },
]

export function seedModels(store: SellerStore): void {
  store.upsertModels(ROBOT_MODELS)
}

const DEMO_ROBOTS: { company: string; name: string; model: string; temperature?: 'WARM' | 'COLD' | 'NEUTRAL' }[] = [
  { company: 'demo', name: 'Demo Food Bot', model: 'model-food', temperature: 'WARM' },
  { company: 'demo', name: 'Food Robot 2', model: 'model-food', temperature: 'COLD' },
  { company: 'demo', name: 'Demo Parcel Bot', model: 'model-parcel' },
  { company: 'gelato', name: 'Robot Gelato 1', model: 'model-food', temperature: 'COLD' },
  { company: 'gelato', name: 'Robot Gelato 2', model: 'model-food', temperature: 'COLD' },
  { company: 'pizzeria-test', name: 'Pizza Bot 1', model: 'model-food', temperature: 'WARM' },
]

/**
 * Fills an empty database for the demo: robots for the made-up companies of the platform simulator
 * and one defect. It goes through the service, so the keys and records are made the normal way.
 */
export async function seedDemo(
  service: SellerService,
  store: SellerStore,
  gateway: PlatformGateway,
  log: (line: string) => void = () => undefined,
): Promise<void> {
  if (store.countRobots() > 0) return
  const companies = await gateway.listCompanies()
  const actor = 'demo-seed'
  let parcelRobotId: string | null = null
  for (const demo of DEMO_ROBOTS) {
    const company = companies.find((item) => item.subdomain === demo.company)
    if (!company) {
      log(`Demo seed: the platform has no company "${demo.company}", robot "${demo.name}" skipped`)
      continue
    }
    const { robot } = await service.createRobot(actor, company.id, {
      name: demo.name,
      modelId: demo.model,
      ...(demo.temperature ? { temperatureType: demo.temperature } : {}),
    })
    if (demo.name === 'Demo Parcel Bot') parcelRobotId = robot.id
  }
  if (parcelRobotId) service.reportDefect(actor, parcelRobotId, { summary: 'Batterij valt snel leeg', severity: 'high' })
  log('Demo seed: robots and one defect created')
}
