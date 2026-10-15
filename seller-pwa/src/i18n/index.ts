import { createI18n } from 'vue-i18n'
import { en } from './en'
import { nl } from './nl'

export const LANGUAGES = ['nl', 'en'] as const
export type Language = (typeof LANGUAGES)[number]

const KEY = 'seller-pwa.language'

function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'nl' || saved === 'en') return saved
  } catch {
    // No storage: follow the browser
  }
  return navigator.language.toLowerCase().startsWith('nl') ? 'nl' : 'en'
}

export const i18n = createI18n({
  legacy: false,
  locale: initialLanguage(),
  fallbackLocale: 'en',
  messages: { nl, en },
})

export function setLanguage(language: Language): void {
  i18n.global.locale.value = language
  document.documentElement.lang = language
  try {
    localStorage.setItem(KEY, language)
  } catch {
    // Not kept: the choice applies until the page closes
  }
}
