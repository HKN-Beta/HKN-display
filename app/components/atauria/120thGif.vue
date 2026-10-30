<script setup lang="ts">
import { useApiV2 } from '~/composables/jorgenel/useApiV2'
import { useLiquidGlass } from '~/composables/jorgenel/useLiquidGlass'
</script>

<template>
    <div ref="cardEl" class="rounded-glass-card">
        <div class="widget-content">
            <div class="tw-header tw-text">
            <NuxtImg
                src="HKN120thSharky.gif"
                alt="HKN 120th Anniversary"
                class="gif"
            />
            <!-- <div class="tw-header tw-text"> -->
            <span>Happy 120th Birthday to HKN Beta Chapter!</span>
            </div>
        </div>
    </div>
</template>

<style scoped>
.gif {
    align-items: center;
    justify-content: center;
    width: 50%;
    height: 100%;
    min-height: 0;
}

.tw-header {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 0.55em;
    font-size: 4em;
    font-weight: 400;
    width: 100%;
}

.tw-text {
    color: #f0f0f0;
    text-shadow:
        0 1px 4px rgba(0, 0, 0, 0.7),
        0 0 10px rgba(0, 0, 0, 0.35);
    position: relative;
    z-index: 1;
}

</style>