/**
 * A company address from its name, e.g. "Pizzeria Têst!" becomes "pizzeria-test".
 * The API accepts 2-30 characters: letters, digits and hyphens, not at the start or end.
 */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
    .replace(/-+$/g, '')
}

/** The same rule as the API (packages/api/src/tenants/subdomain.ts) */
export function isValidSubdomain(value: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/.test(value) && value.length >= 2
}
