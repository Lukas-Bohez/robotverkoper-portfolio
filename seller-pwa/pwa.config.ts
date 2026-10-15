import type { ManifestOptions } from 'vite-plugin-pwa'

/**
 * The web app manifest of the seller PWA. "standalone" opens it without the
 * browser bar, like an app.
 */
export const manifest: Partial<ManifestOptions> = {
  name: 'Delivery robot: robotverkoper',
  short_name: 'Robotverkoper',
  description: 'For the makers of the delivery robots: manage companies and give them robots.',
  lang: 'nl',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'any',
  theme_color: '#4f46e5',
  background_color: '#ffffff',
  icons: [
    { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
    { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
    { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}
