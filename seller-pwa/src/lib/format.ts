/** "2 uur geleden" / "2 hours ago": how long ago something happened, in the language of the screen */
export function relativeTime(iso: string, locale: string, now: number = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000)
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const abs = Math.abs(seconds)
  if (abs < 60) return formatter.format(seconds, 'second')
  if (abs < 3600) return formatter.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return formatter.format(Math.round(seconds / 3600), 'hour')
  return formatter.format(Math.round(seconds / 86400), 'day')
}

export function shortDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "14:12": the time of day, in the language of the screen */
export function timeOfDay(iso: string | Date | null | undefined, locale: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

/** "vrijdag 16 oktober": today as a line under the title of the dashboard */
export function dayLabel(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
}

/** "350 m" below a kilometre, "1,2 km" above it */
export function distanceLabel(meters: number, locale: string): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(meters / 1000)} km`
}

/** The whole minutes between two moments (a defect "since 24 min") */
export function minutesBetween(from: string | Date, to: Date = new Date()): number {
  return Math.max(0, Math.round((to.getTime() - new Date(from).getTime()) / 60_000))
}

/** "company_created" from "company.created" or "company-role.created": a key the translations can hold */
export function translationKey(action: string): string {
  return action.replace(/[.-]/g, '_')
}

/** "orders:read" becomes "orders_read" and the area is "orders" */
export function permissionKey(permission: string): string {
  return permission.replace(/[:-]/g, '_')
}

export function permissionArea(permission: string): string {
  return permission.split(':')[0] ?? permission
}
