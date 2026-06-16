<script setup lang="ts">
import { Autoplay, Pagination } from 'swiper/modules'
import { Swiper, SwiperSlide } from 'swiper/vue'
import 'swiper/css'
import 'swiper/css/pagination'
import { useApiV2 } from '~/composables/jorgenel/useApiV2'
import { useLiquidGlass } from '~/composables/jorgenel/useLiquidGlass'

interface Announcement {
  title: string
  body: string
  image: string
}

const { get } = useApiV2()
const { init: initGlass, destroy: destroyGlass } = useLiquidGlass()
const { init: initTitleGlass, destroy: destroyTitleGlass } = useLiquidGlass({
  frostBlur: 0.8,
  bezelWidth: 20,
  maxDisplacement: 30,
  specularOpacity: 0.28,
  borderRadius: 40,
  tintColor: '#BA0C2F',
  tintOpacity: 0.35
})
const cardEl = ref<HTMLElement | null>(null)
const titleEl = ref<HTMLElement | null>(null)

const announcements = ref<Announcement[]>([])
const loading = ref(false)

const fetchAnnouncements = async (): Promise<void> => {
  loading.value = announcements.value.length === 0
  const response = await get('/announcements')
  loading.value = false

  if (response.success) {
    announcements.value = response.data as Announcement[]
  } else if (response.error) {
    console.error('Announcements API error:', response.error)
  }
}

let refreshInterval: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  await fetchAnnouncements()
  nextTick(() => {
    if (cardEl.value) initGlass(cardEl.value)
    if (titleEl.value) initTitleGlass(titleEl.value)
  })
  refreshInterval = setInterval(fetchAnnouncements, 1000 * 60 * 30) // Refresh every 30 minutes
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
  destroyGlass()
  destroyTitleGlass()
})
</script>

<template>
  <div
    ref="cardEl"
    class="rounded-glass-card"
  >
    <div class="widget-content">
      <div class="announcement-container">
        <div
          ref="titleEl"
          class="announcements-title text-[#F5F6F6]"
        >
          Announcements
        </div>
        <div class="announcement">
          <ClientOnly>
            <Swiper
              v-if="announcements && announcements.length > 0"
              :css-mode="false"
              :modules="[Autoplay, Pagination]"
              :slides-per-view="1"
              :loop="announcements.length > 1"
              :autoplay="{
                delay: 10000,
                disableOnInteraction: false
              }"
              :pagination="{
                clickable: true,
                type: 'bullets',
                dynamicBullets: true,
                dynamicMainBullets: 5
              }"
              :speed="3000"
              :lazy-preload-prev-next="1"
            >
              <SwiperSlide
                v-for="(json, index) in announcements"
                :key="index"
              >
                <div class="combined-slide">
                  <div class="image-section">
                    <NuxtImg
                      :src="json.image"
                      :alt="json.title || 'Announcement'"
                      loading="lazy"
                      class="announcement-image"
                    />
                  </div>
                  <div class="text-section">
                    <h2 class="text-2xl font-bold">
                      {{ json.title }}
                    </h2>
                    <USeparator class="my-3" />
                    <p class="text-lg whitespace-pre-line">
                      {{ json.body }}
                    </p>
                  </div>
                </div>
              </SwiperSlide>
            </Swiper>

            <!-- Skeleton while loading first batch -->
            <div
              v-if="loading"
              class="announcement-skeleton"
            >
              <div
                v-for="n in 3"
                :key="n"
                class="skeleton-row"
              >
                <USkeleton class="skeleton-img" />
                <div class="skeleton-text">
                  <USkeleton class="skeleton-title" />
                  <USkeleton class="skeleton-line" />
                  <USkeleton class="skeleton-line" />
                  <USkeleton class="skeleton-line skeleton-line--short" />
                </div>
              </div>
            </div>

            <template #fallback>
              <!-- SSR fallback -->
              <div class="w-full h-full flex items-center justify-center">
                <div class="text-center">
                  <p class="text-gray-500">
                    Loading...
                  </p>
                </div>
              </div>
            </template>
          </ClientOnly>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.announcement-container {
    display: flex;
    flex-direction: column;
    gap: 0.6em;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
}

.announcements-title {
    display: flex;
    justify-content: center;
    align-items: center;
    width: fit-content;

    box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.25);
    border-radius: 5em;

    font-size: 1.75em;
    padding: 0.25em 1em;
}

.announcement {
    width: 100%;
    flex: 1;
    min-height: 0;
    overflow: hidden;
}

.swiper {
  width: 100%;
  height: 100%;
  max-width: 50vw;
  --swiper-theme-color: #BA0C2F;
  --swiper-pagination-bullet-inactive-color: #4e0315;
  --swiper-pagination-bullet-inactive-opacity: 0.5;
}

.swiper-slide {
  text-align: center;
  font-size: 18px;

  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  width: 100%;
}

.image-slide {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
}

.announcement-image {
  max-height: 100%;
  max-width: 100%;
  height: auto;
  width: auto;
  object-fit: contain;
}

.combined-slide {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  width: 100%;
  height: 100%;
  gap: 1em;
  padding: 0.5em;
  box-sizing: border-box;
  overflow: hidden;
}

.image-section {
  flex: 1 1 45%;
  min-width: 0;
  min-height: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}

.image-section .announcement-image {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 0.5rem;
}

.text-section {
  flex: 1 1 45%;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  text-align: left;
  padding: 0.5em;
  overflow-y: auto;
}

/* ── skeleton ────────────────────────────────────────────── */
.announcement-skeleton {
  display: flex;
  flex-direction: column;
  gap: 1em;
  width: 100%;
  padding: 0.5em;
}

.skeleton-row {
  display: flex;
  flex-direction: row;
  gap: 1em;
  align-items: flex-start;
}

.skeleton-img {
  flex: 0 0 40%;
  height: 5em;
  border-radius: 0.4em;
}

.skeleton-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.4em;
}

.skeleton-title {
  width: 70%;
  height: 1.4em;
  border-radius: 0.3em;
}

.skeleton-line {
  width: 100%;
  height: 1em;
  border-radius: 0.3em;
}

.skeleton-line--short {
  width: 60%;
}
</style>
