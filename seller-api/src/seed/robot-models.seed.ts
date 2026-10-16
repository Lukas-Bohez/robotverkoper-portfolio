import { ModelKind } from '../robots/entities/robot-model.entity.js'

/** What we build and sell: our own catalogue (no link with the models of the platform) */
export const ROBOT_MODELS = [
  {
    id: 'model-food',
    name: 'Delivery Bot Eten',
    kind: ModelKind.FOOD,
    description:
      'Geïsoleerde bezorgrobot voor eten: houdt de temperatuur van de bestelling vast. Eén type, geen warm, koud of neutraal',
  },
  {
    id: 'model-parcel',
    name: 'Delivery Bot Pakket',
    kind: ModelKind.PARCEL,
    description: 'Bezorgrobot met een gewoon vak voor pakketten en kleine bestellingen',
  },
]

/** The robots of the demo: for the made-up companies of the platform simulator. `online` and `battery` are what the simulated platform shows until a real robot app reports itself. */
export const DEMO_ROBOTS = [
  { company: 'demo', name: 'Demo Food Bot', model: 'model-food', online: true, battery: 87 },
  { company: 'demo', name: 'Food Robot 2', model: 'model-food', online: true, battery: 100 },
  { company: 'demo', name: 'Demo Parcel Bot', model: 'model-parcel', online: true, battery: 12 },
  { company: 'gelato', name: 'Robot Gelato 1', model: 'model-food', online: true, battery: 64 },
  { company: 'gelato', name: 'Robot Gelato 2', model: 'model-food', online: false, battery: 41 },
  { company: 'pizzeria-test', name: 'Pizza Bot 1', model: 'model-food', online: false, battery: 100 },
]

/** The demo defect: this robot has a battery that runs flat */
export const DEMO_DEFECT = {
  robot: 'Demo Parcel Bot',
  summary: 'Batterij valt snel leeg',
  severity: 'high' as const,
}
