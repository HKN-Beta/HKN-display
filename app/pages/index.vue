<script setup lang="ts">
definePageMeta({
  layout: false
})

interface DisplayPageCard {
  title: string
  path: string
  description: string
  status: string
}

const router = useRouter()

const toTitle = (path: string) => {
  const segment = path.replace(/^\//, '')
  if (!segment) return 'Display page'
  return `${segment.charAt(0).toUpperCase()}${segment.slice(1)} display`
}

const pages = computed<DisplayPageCard[]>(() => {
  return router.getRoutes()
    .map((route) => {
      const path = route.path
      if (
        !path
        || path === '/'
        || path.includes(':')
        || path.includes('*')
        || path.startsWith('/_')
      ) {
        return null
      }

      const meta = route.meta || {}

      return {
        title: typeof meta.title === 'string' ? meta.title : toTitle(path),
        path,
        description: typeof meta.description === 'string'
          ? meta.description
          : `Display page for ${path}`,
        status: typeof meta.status === 'string' ? meta.status : 'active'
      }
    })
    .filter((page): page is DisplayPageCard => Boolean(page))
    .sort((a, b) => a.path.localeCompare(b.path))
})
</script>

<template>
  <main class="min-h-screen px-6 py-8 sm:px-10 lg:px-16">
    <section class="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl flex-col justify-center gap-8">
      <div class="max-w-3xl space-y-5">
        <p class="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--display-gold)]/90">
          HKN display onboarding
        </p>
        <h1 class="text-4xl font-black tracking-tight text-white sm:text-6xl">
          Welcome to the HKN display onboarding page
        </h1>
        <p class="max-w-2xl text-base leading-7 text-[var(--display-muted)] sm:text-lg">
          This workspace now serves the standalone display app. The migrated HKN display
          now lives under <span class="font-semibold text-white">/jorgenel</span>, while each person
          adds their own page under a folder named after their alias.
        </p>
      </div>

      <div class="grid gap-5 md:grid-cols-2">
        <NuxtLink
          v-for="page in pages"
          :key="page.path"
          :to="page.path"
          class="group rounded-3xl border border-white/10 bg-[var(--display-surface)] p-6 shadow-2xl backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-[var(--display-gold)]/40 hover:bg-white/10"
        >
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="text-sm uppercase tracking-[0.25em] text-[var(--display-gold)]/80">
                {{ page.status }}
              </p>
              <h2 class="mt-2 text-2xl font-semibold text-white">
                {{ page.title }}
              </h2>
            </div>
            <span class="text-3xl text-white/40 transition group-hover:text-[var(--display-gold)]">&#8599;</span>
          </div>
          <p class="mt-4 text-sm leading-6 text-[var(--display-muted)]">
            {{ page.description }}
          </p>
          <div class="mt-6 inline-flex rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/90">
            {{ page.path }}
          </div>
        </NuxtLink>
      </div>

      <div class="rounded-3xl border border-white/10 bg-black/20 p-6 text-sm leading-6 text-[var(--display-muted)] shadow-xl backdrop-blur-xl">
        To add a page, create <span class="font-semibold text-white">app/pages/&lt;alias&gt;/index.vue</span>.
        Alias pages appear here automatically. For nested alias composables, keep files inside
        <span class="font-semibold text-white">app/composables/&lt;alias&gt;/...</span>.
      </div>
    </section>
  </main>
</template>
