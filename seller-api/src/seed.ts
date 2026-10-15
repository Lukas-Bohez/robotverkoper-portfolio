import type { PlatformGateway } from './platform.ts'
import type { SellerService } from './service.ts'
import type { RobotModel, SellerStore } from './store.ts'

/** What we build and sell: our own catalogue (no link with the models of the platform) */
export const ROBOT_MODELS: RobotModel[] = [
  {
    id: 'model-food',
    name: 'Delivery Bot Eten',
    kind: 'FOOD',
    description: 'Geïsoleerde bezorgrobot voor eten: houdt de temperatuur van de bestelling vast. Eén type, geen warm, koud of neutraal',
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

const DEMO_ROBOTS: {
  company: string
  name: string
  model: string
  /** How the simulated platform shows it, until a real robot app reports itself */
  online: boolean
  battery: number
}[] = [
  { company: 'demo', name: 'Demo Food Bot', model: 'model-food', online: true, battery: 87 },
  { company: 'demo', name: 'Food Robot 2', model: 'model-food', online: true, battery: 100 },
  { company: 'demo', name: 'Demo Parcel Bot', model: 'model-parcel', online: true, battery: 12 },
  { company: 'gelato', name: 'Robot Gelato 1', model: 'model-food', online: true, battery: 64 },
  { company: 'gelato', name: 'Robot Gelato 2', model: 'model-food', online: false, battery: 41 },
  { company: 'pizzeria-test', name: 'Pizza Bot 1', model: 'model-food', online: false, battery: 100 },
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
    })
    if (demo.name === 'Demo Parcel Bot') parcelRobotId = robot.id
    await gateway.simulateTelemetry?.(robot.id, { online: demo.online, battery: demo.battery })
  }
  if (parcelRobotId) service.reportDefect(actor, parcelRobotId, { summary: 'Batterij valt snel leeg', severity: 'high' })
  log('Demo seed: robots and one defect created')
}
