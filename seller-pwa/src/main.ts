import './assets/css/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ui from '@nuxt/ui/vue-plugin'
import App from './App.vue'
import router from './router'
import { i18n } from './i18n'
import { registerSW } from 'virtual:pwa-register'

const app = createApp(App)

app.use(createPinia()) // before the router: its guard uses the stores
app.use(i18n) // always before the router
app.use(router)
app.use(ui)

app.mount('#app')

// The service worker (production only): installable, and the app shell also loads offline
registerSW({ immediate: true })
