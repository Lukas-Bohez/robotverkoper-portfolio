import { computed } from 'vue'
import { FALLBACK_LANGUAGE, i18n, initialLanguage, LANGUAGES, rememberLanguage, type Language } from '@/i18n'

/** One JSON file per language, loaded the first time the language is needed */
const LOADERS: Record<Language, () => Promise<{ default: Record<string, unknown> }>> = {
  nl: () => import('@/locales/nl.json'),
  en: () => import('@/locales/en.json'),
  fr: () => import('@/locales/fr.json'),
  de: () => import('@/locales/de.json'),
}

async function loadMessages(language: Language): Promise<void> {
  if (i18n.global.availableLocales.includes(language)) return
  const messages = await LOADERS[language]()
  i18n.global.setLocaleMessage(language, messages.default)
}

/**
 * The language of the app: the four languages of the design (EN, NL, FR, DE), loaded when chosen, kept in the
 * browser, and written to `<html lang>` (for screen readers and translation tools).
 */
export function useLanguage() {
  const language = computed(() => i18n.global.locale.value as Language)

  async function setLanguage(next: Language): Promise<void> {
    await loadMessages(FALLBACK_LANGUAGE)
    await loadMessages(next)
    i18n.global.locale.value = next
    document.documentElement.lang = next
    rememberLanguage(next)
  }

  /** At the start of the app: English (the fallback) and the language of the person */
  async function init(): Promise<void> {
    await setLanguage(initialLanguage())
  }

  return { language, languages: LANGUAGES, setLanguage, init }
}
