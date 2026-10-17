import { createI18n } from 'vue-i18n'
import { LANGUAGES, type Language } from '@/api/types'

export { LANGUAGES }
export type { Language }

/** What is shown when a language misses a text (and the language that is always loaded) */
export const FALLBACK_LANGUAGE: Language = 'en'

const KEY = 'seller-pwa.language'

/** The language of the person: what they chose before, else the language of the browser, else English */
export function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem(KEY)
    if (LANGUAGES.includes(saved as Language)) return saved as Language
  } catch {
    // No storage: follow the browser
  }
  const browser = navigator.language.toLowerCase().slice(0, 2)
  return LANGUAGES.find(code => code === browser) ?? FALLBACK_LANGUAGE
}

export function rememberLanguage(language: Language): void {
  try {
    localStorage.setItem(KEY, language)
  } catch {
    // Not kept: the choice applies until the page closes
  }
}

/**
 * The texts live in one JSON file per language (src/locales). They are loaded when needed (see
 * composables/useLanguage.ts): only English and the chosen language travel to the browser.
 */
export const i18n = createI18n({
  legacy: false,
  locale: FALLBACK_LANGUAGE,
  fallbackLocale: FALLBACK_LANGUAGE,
  messages: {},
})
