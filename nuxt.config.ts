// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxt/image',
    'nuxt-swiper'
  ],

  imports: {
    dirs: ['~/composables/**']
  },

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css', '~/assets/css/glass-card.css'],

  routeRules: {
    '/': { prerender: true },
    '/default': { prerender: true },
    '/jorgenel': { ssr: false }
  },


  compatibilityDate: '2025-01-15',

  vite: {
    optimizeDeps: {
      include: ['swiper/modules']
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
