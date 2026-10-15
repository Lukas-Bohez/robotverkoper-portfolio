import type { SeedCompany } from './server.ts'

/**
 * The made-up companies of the demo. They exist only in this simulator: no real restaurant, no
 * staff, no customers. The ids are fixed so the seller API and its tests can point at them.
 */
export const DEMO_COMPANIES: SeedCompany[] = [
  {
    id: '6f1c1b2a-0001-4a00-8000-00000000d001',
    name: 'Demozaak',
    subdomain: 'demo',
    adminEmail: 'beheer@demozaak.example',
    createdAt: '2026-09-23T08:00:00.000Z',
  },
  {
    id: '6f1c1b2a-0002-4a00-8000-00000000d002',
    name: 'Gelato Bar',
    subdomain: 'gelato',
    adminEmail: 'beheer@gelato.example',
    createdAt: '2026-10-10T09:30:00.000Z',
  },
  {
    id: '6f1c1b2a-0003-4a00-8000-00000000d003',
    name: 'Pizzeria Test',
    subdomain: 'pizzeria-test',
    adminEmail: 'beheer@pizzeria.example',
    createdAt: '2026-10-14T11:15:00.000Z',
  },
]
