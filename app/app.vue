<script setup lang="ts">
const title = 'HKN Display Onboarding'
const description = 'Welcome to the HKN display onboarding page.'
const TOP_EDGE_TRIGGER_PX = 32

interface DisplayNavItem {
  title: string
  path: string
}

const router = useRouter()
const route = useRoute()
const isTopNavVisible = ref(false)
const isPointerInNav = ref(false)

const toTitle = (path: string): string => {
  if (path === '/') return 'Home'
  const segment = path.replace(/^\//, '')
  return `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`
}

const displayRoutes = computed<DisplayNavItem[]>(() => {
  return router.getRoutes()
    .map((entry) => {
      const path = entry.path
      if (!path || path.includes(':') || path.includes('*') || path.startsWith('/_')) {
        return null
      }

      return {
        title: typeof entry.meta?.title === 'string' ? entry.meta.title : toTitle(path),
        path
      }
    })
    .filter((item): item is DisplayNavItem => Boolean(item))
    .sort((a, b) => a.path.localeCompare(b.path))
})

const otherDisplayRoutes = computed(() => {
  return displayRoutes.value.filter(item => item.path !== route.path)
})

const onWindowMouseMove = (event: MouseEvent): void => {
  if (event.clientY <= TOP_EDGE_TRIGGER_PX) {
    isTopNavVisible.value = true
    return
  }

  if (!isPointerInNav.value) {
    isTopNavVisible.value = false
  }
}

const onNavEnter = (): void => {
  isPointerInNav.value = true
  isTopNavVisible.value = true
}

const onNavLeave = (): void => {
  isPointerInNav.value = false
  isTopNavVisible.value = false
}

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { name: 'description', content: description }
  ],
  link: [{ rel: 'icon', href: '/favicon.ico' }],
  htmlAttrs: { lang: 'en' }
})

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  twitterCard: 'summary_large_image'
})

onMounted(() => {
  window.addEventListener('mousemove', onWindowMouseMove, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onWindowMouseMove)
})
</script>

<template>
  <UApp>
    <div
      class="top-display-nav"
      :class="{ 'top-display-nav--open': isTopNavVisible }"
      @mouseenter="onNavEnter"
      @mouseleave="onNavLeave"
    >
      <div class="top-display-nav__inner">
        <p class="top-display-nav__label">
          Displays
        </p>
        <div class="top-display-nav__buttons">
          <UButton
            v-for="item in otherDisplayRoutes"
            :key="item.path"
            :to="item.path"
            size="xs"
            color="neutral"
            variant="soft"
            :label="item.title"
          />
        </div>
      </div>
    </div>
    <NuxtPage />
  </UApp>
</template>

<style scoped>
.top-display-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1200;
  transform: translateY(calc(-100% + 8px));
  transition: transform 180ms ease;
  pointer-events: auto;
}

.top-display-nav--open {
  transform: translateY(0);
}

.top-display-nav__inner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border-bottom: 1px solid rgb(255 255 255 / 0.15);
  background: rgb(3 10 35 / 0.9);
  backdrop-filter: blur(8px);
  padding: 0.4rem 0.8rem;
}

.top-display-nav__label {
  flex: none;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgb(255 199 44 / 0.95);
}

.top-display-nav__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}
</style>
