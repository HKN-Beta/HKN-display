<template>
  <div
    v-if="loaded && quotes.length"
    ref="cardEl"
    class="rounded-glass-card ticker-bar"
  >
    <div class="ticker-track">
      <div class="ticker-content">
        Happy 120th Birthday to the HKN Beta Chapter! (Est. 1906)
      </div>
    </div>
  </div>
</template>

<style scoped>
.ticker-bar {
    width: 100%;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.25);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    /* Override the 20px from .rounded-glass-card — ticker needs a tighter radius */
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

.ticker-track {
    display: flex;
    width: max-content;
    animation: ticker-scroll 60s linear infinite;
    will-change: transform;
    transform: translateZ(0);
}

.ticker-content {
    display: flex;
    flex-shrink: 0;
}

.ticker-item {
    display: inline-flex;
    align-items: center;
    gap: 0.55em;
    padding: 0.35em 1.8em;
    white-space: nowrap;
    font-size: 1.7em;
    color: #f0f0f0;
    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
    border-right: 1px solid rgba(255,255,255,0.08);
}

.ticker-symbol {
    font-weight: 700;
    letter-spacing: 0.03em;
}

.ticker-price {
    font-weight: 500;
    opacity: 0.9;
}

.ticker-change {
    font-weight: 600;
    font-size: 0.95em;
}

.ticker-change.up {
    color: #4ade80;
}

.ticker-change.down {
    color: #f87171;
}

.ticker-change.flat {
    color: #94a3b8;
}

@keyframes ticker-scroll {
    0% {
        transform: translateX(0);
    }
    100% {
        transform: translateX(-50%);
    }
}

/* Pause on hover for readability */
.ticker-bar:hover .ticker-track {
    animation-play-state: paused;
}
</style>
