import './assets/css/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ui from '@nuxt/ui/vue-plugin'
import { DefaultApolloClient } from '@vue/apollo-composable'
import App from './App.vue'
import router from './router'
import { i18n } from './i18n'
import useGraphql from './composables/useGraphql'
import { useLanguage } from './composables/useLanguage'
import { registerSW } from 'virtual:pwa-register'

const app = createApp(App)
const { apolloClient } = useGraphql()

// The composables of vue-apollo (useSubscription) find the client of the seller API here
app.provide(DefaultApolloClient, apolloClient)

app.use(createPinia()) // before the router: its guard uses the stores
app.use(i18n) // always before the router
app.use(router)
app.use(ui)

// English (the fallback) and the language of the person are loaded first: no screen shows a bare translation key
await useLanguage().init()

app.mount('#app')

// The service worker (production only): installable, and the app shell also loads offline
registerSW({ immediate: true })
