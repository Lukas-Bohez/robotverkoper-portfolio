import type { LocalizedNames } from '../entities/localized-names.entity.js'
import { ModelKind } from '../robots/enums/model-kind.enum.js'

/** What we build and sell: our own catalogue (no link with the models of the platform) */
export const ROBOT_MODELS = [
  {
    key: 'model-food',
    name: 'Delivery Bot Eten',
    kind: ModelKind.FOOD,
    description:
      'Geïsoleerde bezorgrobot voor eten: houdt de temperatuur van de bestelling vast. Eén type, geen warm, koud of neutraal',
  },
  {
    key: 'model-parcel',
    name: 'Delivery Bot Pakket',
    kind: ModelKind.PARCEL,
    description: 'Bezorgrobot met een gewoon vak voor pakketten en kleine bestellingen',
  },
]

/** Where the robots of the demo stand: the made-up companies are neighbours in Kortrijk (GeoJSON: [longitude, latitude]) */
const place = (address: string, longitude: number, latitude: number) => ({
  country: 'BE',
  address,
  longitude,
  latitude,
})

const MARKSE = place('Marksesteenweg 58, Kortrijk', 3.2647, 50.8283)
const MARKSE_60 = place('Marksesteenweg 60, Kortrijk', 3.265, 50.8293)
const VELD = place('Veldstraat 12, Kortrijk', 3.2605, 50.8299)

/**
 * The robots of the demo: for the made-up companies of the platform simulator. `online` and `battery` are what the
 * simulated platform shows until a real robot app reports itself. `serial` is the number on the QR code.
 */
export const DEMO_ROBOTS = [
  {
    company: 'demo',
    name: 'Demo Food Bot',
    serial: 'RBT-000211',
    model: 'model-food',
    online: true,
    battery: 87,
    place: MARKSE,
  },
  {
    company: 'demo',
    name: 'Food Robot 2',
    serial: 'RBT-000212',
    model: 'model-food',
    online: true,
    battery: 41,
    place: MARKSE,
  },
  {
    company: 'demo',
    name: 'Demo Parcel Bot',
    serial: 'RBT-000213',
    model: 'model-parcel',
    online: true,
    battery: 12,
    place: MARKSE_60,
  },
  {
    company: 'gelato',
    name: 'Robot Gelato 1',
    serial: 'RBT-000301',
    model: 'model-food',
    online: true,
    battery: 64,
    place: VELD,
  },
  {
    company: 'gelato',
    name: 'Robot Gelato 2',
    serial: 'RBT-000302',
    model: 'model-food',
    online: false,
    battery: 41,
    place: VELD,
  },
  {
    company: 'pizzeria-test',
    name: 'Pizza Bot 1',
    serial: 'RBT-000401',
    model: 'model-food',
    online: false,
    battery: 100,
    place: MARKSE,
  },
]

/** Robots in the warehouse: ready to be scanned by a technician who replaces a defective robot */
export const STOCK_ROBOTS = [
  { name: 'Reserve Food Bot 1', serial: 'RBT-000417', model: 'model-food' },
  { name: 'Reserve Food Bot 2', serial: 'RBT-000418', model: 'model-food' },
  { name: 'Reserve Parcel Bot 1', serial: 'RBT-000419', model: 'model-parcel' },
]

/** The condition of the defective robots, as the platform last heard it (see PlatformGateway.simulateCondition) */
export const DEMO_CONDITIONS: Record<string, Record<string, unknown>> = {
  'Food Robot 2': {
    tilted: true,
    tiltDegrees: 35,
    hasCargo: true,
    cargoSummary: 'Bestelling 5B57B0: 1× Caesar Salad, 1× Iced Tea',
    compartmentTemp: 6,
    lid: 'LOCKED',
    errorCode: 'E42',
    errorText: 'Wielmotor links blokkeert',
    location: MARKSE,
  },
  'Demo Parcel Bot': {
    tilted: false,
    tiltDegrees: null,
    hasCargo: false,
    lid: 'LOCKED',
    errorCode: 'E07',
    errorText: 'Batterij valt snel leeg',
    location: MARKSE_60,
  },
  'Robot Gelato 1': {
    tilted: false,
    tiltDegrees: null,
    hasCargo: false,
    lid: 'LOCKED',
    errorCode: 'E17',
    errorText: 'Sensor vooraan zit vast',
    location: VELD,
  },
}

/** The defects of the demo: three robots that do not work. The first has food inside and stands crooked. */
export const DEMO_DEFECTS = [
  {
    robot: 'Food Robot 2',
    summary: 'Robot staat scheef en de linkerwielmotor blokkeert',
    severity: 'high' as const,
  },
  { robot: 'Demo Parcel Bot', summary: 'Batterij valt snel leeg', severity: 'medium' as const },
  { robot: 'Robot Gelato 1', summary: 'Sensor vast', severity: 'low' as const },
]

/** A technician is already on the way to the first defect */
export const DEMO_CLAIM = { robot: 'Food Robot 2', technician: 'technieker@fabrikant.be' }

/** Defects of earlier years: they are in cold storage, so the filter per year and the cold storage can be shown */
export const OLD_DEFECTS = [
  {
    robot: 'Demo Food Bot',
    summary: 'Wiel sleept over de grond',
    severity: 'medium' as const,
    createdAt: '2025-03-12T09:20:00.000Z',
    resolvedAt: '2025-03-12T13:05:00.000Z',
    resolution: 'repaired' as const,
    note: 'Wiel vervangen',
  },
  {
    robot: 'Demo Food Bot',
    summary: 'Klep sluit niet meer',
    severity: 'high' as const,
    createdAt: '2024-11-02T15:40:00.000Z',
    resolvedAt: '2024-11-03T08:10:00.000Z',
    resolution: 'repaired' as const,
    note: 'Scharnier vervangen',
  },
]

/** The other roles of our own staff that the demo starts with (besides the administrator and the technician) */
export const EXTRA_SELLER_ROLES: { key: string; names: LocalizedNames; permissions: string[] }[] = [
  {
    key: 'helpdesk',
    names: { nl: 'Helpdesk', en: 'Helpdesk', fr: 'Assistance', de: 'Helpdesk' },
    permissions: [
      'companies:read',
      'robots:read',
      'defects:read',
      'defects:report',
      'audit:read',
      'archive:read',
      'exports:invoices',
    ],
  },
  {
    key: 'stagiair',
    names: { nl: 'Stagiair', en: 'Trainee' },
    permissions: ['companies:read', 'robots:read', 'defects:read'],
  },
]

/** People of the demo besides the administrators of the settings. The last one was archived (soft delete). */
export const DEMO_ACCOUNTS = [
  { email: 'technieker@fabrikant.be', roleKey: 'technician', archived: false },
  { email: 'helpdesk@fabrikant.be', roleKey: 'helpdesk', archived: false },
  { email: 'technieker.oud@fabrikant.be', roleKey: 'technician', archived: true },
]

/** The roles of a company that are used again and again: a preset is a role with its rights and its names */
export const ROLE_PRESETS: { names: LocalizedNames; permissions: string[] }[] = [
  {
    names: { nl: 'Kok', en: 'Cook', fr: 'Cuisinier', de: 'Koch' },
    permissions: ['orders:read', 'orders:prepare', 'menu:read'],
  },
  {
    names: { nl: 'Lader', en: 'Loader', fr: 'Chargeur', de: 'Lader' },
    permissions: ['orders:read', 'orders:dispatch', 'robots:read', 'robots:load'],
  },
  {
    names: { nl: 'Ober', en: 'Waiter' },
    permissions: ['orders:read', 'menu:read'],
  },
  {
    names: { nl: 'Kassier', en: 'Cashier', fr: 'Caissier', de: 'Kassierer' },
    permissions: ['orders:read', 'orders:manage'],
  },
]

/** The presets that the first company of the demo gets */
export const DEMO_COMPANY_PRESETS = ['Kok', 'Lader', 'Ober']
