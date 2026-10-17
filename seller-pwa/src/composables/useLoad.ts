import { ref } from 'vue'
import { apiErrorMessage } from '@/lib/errors'

/**
 * What every screen does to show data: a loading state (skeletons, not a blank page), the data, or a sentence that says
 * what went wrong. `run(true)` loads again quietly (a realtime refresh must not flash the skeletons).
 */
export function useLoad(load: () => Promise<void>, fallback: () => string) {
  const loading = ref(true)
  const error = ref('')

  async function run(quiet = false): Promise<void> {
    if (!quiet) loading.value = true
    error.value = ''
    try {
      await load()
    } catch (e) {
      error.value = apiErrorMessage(e, fallback())
    } finally {
      loading.value = false
    }
  }

  return { loading, error, run }
}

/** A change the person asks for (a button): busy while it runs, a sentence when it fails */
export function useAction() {
  const busy = ref(false)
  const error = ref('')

  async function run<T>(action: () => Promise<T>, fallback: string): Promise<T | undefined> {
    busy.value = true
    error.value = ''
    try {
      return await action()
    } catch (e) {
      error.value = apiErrorMessage(e, fallback)
      return undefined
    } finally {
      busy.value = false
    }
  }

  return { busy, error, run }
}
