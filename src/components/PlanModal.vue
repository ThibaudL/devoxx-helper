<script setup>
import { ref, computed, watch } from 'vue'
import { usePlanModal } from '../composables/usePlanModal'

const emit = defineEmits(['close'])
const { planRoom, closePlan } = usePlanModal()

const FLOORS = [
  { key: 'rdc',     label: 'Hall d\'exposition', sub: 'Exposants · Salle Maillot', src: '/1_plan_large.png' },
  { key: 'niveau1', label: 'Niveau 1',            sub: 'Salles 141–153',            src: '/1_Plan_first_floor.png' },
  { key: 'niveau2', label: 'Niveau 2',            sub: 'Salles 241–253',            src: '/1_Plan_second_floor.png' },
]

// Highlight positions as % of image dimensions (cx/cy = center point).
// Coordinates estimated from the floor plan images.
const HIGHLIGHTS = [
  // RDC
  { match: n => /maillot/i.test(n),                          floor: 'rdc',     cx: 70, cy: 73 },
  // Niveau 2 — Amphi Bleu
  { match: n => /amphi/i.test(n),                            floor: 'niveau2', cx: 50, cy: 22 },
  // Niveau 2 — Neuilly (25x)
  { match: n => /\b253\b/.test(n),                           floor: 'niveau2', cx: 15, cy: 32 },
  { match: n => /\b252/.test(n) && /ab/i.test(n),            floor: 'niveau2', cx: 15, cy: 46 },
  { match: n => /\b252\b/.test(n) && !/ab/i.test(n),         floor: 'niveau2', cx: 15, cy: 46 },
  { match: n => /\b251\b/.test(n),                           floor: 'niveau2', cx: 15, cy: 60 },
  // Niveau 2 — Paris (24x)
  { match: n => /\b243\b/.test(n),                           floor: 'niveau2', cx: 85, cy: 32 },
  { match: n => /\b242/.test(n) && /ab/i.test(n),            floor: 'niveau2', cx: 85, cy: 46 },
  { match: n => /\b242\b/.test(n) && !/ab/i.test(n),         floor: 'niveau2', cx: 85, cy: 46 },
  { match: n => /\b241\b/.test(n),                           floor: 'niveau2', cx: 85, cy: 60 },
  // Niveau 1 — Neuilly (15x)
  { match: n => /\b153\b/.test(n),                           floor: 'niveau1', cx: 20, cy: 43 },
  { match: n => /\b152\b/.test(n),                           floor: 'niveau1', cx: 20, cy: 63 },
  { match: n => /\b151\b/.test(n),                           floor: 'niveau1', cx: 20, cy: 80 },
  // Niveau 1 — Paris (14x)
  { match: n => /\b143\b/.test(n),                           floor: 'niveau1', cx: 80, cy: 43 },
  { match: n => /\b142\b/.test(n),                           floor: 'niveau1', cx: 80, cy: 63 },
  { match: n => /\b141\b/.test(n),                           floor: 'niveau1', cx: 80, cy: 80 },
]

function getRoomHighlight(roomName) {
  if (!roomName) return null
  return HIGHLIGHTS.find(h => h.match(roomName)) ?? null
}

const active = ref('rdc')

const activeFloor = computed(() => FLOORS.find(f => f.key === active.value))

const highlight = computed(() => {
  const h = getRoomHighlight(planRoom.value)
  return h?.floor === active.value ? h : null
})

watch(planRoom, name => {
  const h = getRoomHighlight(name)
  if (h) active.value = h.floor
}, { immediate: true })

function onOverlayClick(e) {
  if (e.target === e.currentTarget) { closePlan(); emit('close') }
}
function onClose() { closePlan(); emit('close') }
</script>

<template>
  <Teleport to="body">
    <div class="overlay" @click="onOverlayClick">
      <div class="modal" role="dialog" aria-label="Plan du palais des congrès">
        <div class="modal-header">
          <span class="modal-title">🗺 Plan</span>
          <div class="tabs">
            <button
              v-for="f in FLOORS" :key="f.key"
              :class="['tab', { active: active === f.key }]"
              @click="active = f.key"
            >
              <span class="tab-label">{{ f.label }}</span>
              <span class="tab-sub">{{ f.sub }}</span>
            </button>
          </div>
          <button class="close-btn" @click="onClose">✕</button>
        </div>

        <div class="map-wrap">
          <div class="img-frame">
            <img :key="activeFloor.key" :src="activeFloor.src" :alt="activeFloor.label" class="map-img" />
            <div v-if="highlight" class="pin" :style="{ left: highlight.cx + '%', top: highlight.cy + '%' }">
              <div class="pin-ring" />
              <div class="pin-dot" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0;
  background: rgba(15, 23, 42, 0.95);
  display: flex; flex-direction: column;
  z-index: 100;
  backdrop-filter: blur(8px);
}

.modal {
  display: flex; flex-direction: column;
  width: 100%; height: 100%;
}

.modal-header {
  display: flex; align-items: center; gap: 1.5rem;
  padding: 1rem 1.5rem;
  flex-shrink: 0;
  background: rgba(15, 23, 42, 0.8);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-title {
  font-size: 1.25rem; font-weight: 700; color: #fff;
  display: flex; align-items: center; gap: 0.5rem;
}

.tabs { display: flex; gap: 0.75rem; flex: 1; }

.tab {
  display: flex; flex-direction: column; align-items: flex-start;
  padding: 0.5rem 1rem;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-md);
  background: rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.6);
  cursor: pointer; transition: all 0.2s; text-align: left;
}
.tab-label { font-size: 0.875rem; font-weight: 700; }
.tab-sub { font-size: 0.75rem; font-weight: 500; color: rgba(255,255,255,0.4); margin-top: 0.125rem; }
.tab.active { background: var(--accent); border-color: var(--accent); color: white; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3); }
.tab.active .tab-sub { color: rgba(255,255,255,0.8); }
.tab:hover:not(.active) { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.9); }

.close-btn {
  width: 2.5rem; height: 2.5rem; border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.05);
  cursor: pointer; font-size: 1rem; color: #fff;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s;
}
.close-btn:hover { background: #ef4444; border-color: #ef4444; }

.map-wrap {
  flex: 1; overflow: auto;
  display: flex; align-items: center; justify-content: center;
  padding: 2rem;
}

/* Wrapper shrinks to the rendered image size so % positions map to image coords */
.img-frame {
  position: relative;
  display: inline-block;
  line-height: 0;
}

.map-img {
  display: block;
  max-width: calc(100vw - 4rem);
  max-height: calc(100vh - 9rem);
  filter: drop-shadow(0 20px 50px rgba(0,0,0,0.5));
}

/* Pulsing highlight pin */
.pin {
  position: absolute;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.pin-dot {
  position: absolute;
  inset: 50%; transform: translate(-50%, -50%);
  width: 14px; height: 14px; border-radius: 50%;
  background: #facc15;
  box-shadow: 0 0 0 3px rgba(250, 204, 21, 0.6);
  z-index: 2;
}

.pin-ring {
  width: 52px; height: 52px; border-radius: 50%;
  border: 3px solid #facc15;
  opacity: 0;
  animation: ping 1.4s cubic-bezier(0, 0, 0.2, 1) infinite;
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
}

@keyframes ping {
  0%   { transform: translate(-50%, -50%) scale(0.5); opacity: 0.9; }
  100% { transform: translate(-50%, -50%) scale(1.8); opacity: 0; }
}

@media (max-width: 768px) {
  .modal-header { flex-direction: column; align-items: stretch; gap: 1rem; }
  .tabs { overflow-x: auto; padding-bottom: 0.5rem; }
  .tab { flex: 0 0 auto; min-width: 140px; }
  .close-btn { position: absolute; top: 1rem; right: 1rem; }
}
</style>
