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

// ── Floor & destination ───────────────────────────────────────────
const active = ref('rdc')
const activeFloor = computed(() => FLOORS.find(f => f.key === active.value))
const destHighlight = computed(() => {
  const h = getRoomHighlight(planRoom.value)
  return h?.floor === active.value ? h : null
})

// ── Navigation: source selection ─────────────────────────────────
const placingPin = ref(false)   // click-to-place mode
const sourcePin  = ref(null)    // { cx, cy, floor } manually placed

const sourcePoint = computed(() => sourcePin.value ?? null)

const hasSource = computed(() => !!sourcePoint.value)

// ── Stairs positions (% of image) — left = Neuilly side, right = Paris side ──
const STAIRS = {
  rdc:     { left: { cx: 18, cy: 25 }, right: { cx: 82, cy: 25 } },
  niveau1: { left: { cx: 10, cy: 42 }, right: { cx: 90, cy: 42 } },
  niveau2: { left: { cx: 10, cy: 27 }, right: { cx: 90, cy: 27 } },
}

function nearestStairs(pt, floor) {
  const s = STAIRS[floor]
  if (!s) return null
  const dl = Math.hypot(pt.cx - s.left.cx,  pt.cy - s.left.cy)
  const dr = Math.hypot(pt.cx - s.right.cx, pt.cy - s.right.cy)
  return dl <= dr
    ? { side: 'left',  ...s.left  }
    : { side: 'right', ...s.right }
}

// Cross-floor info (null when same floor)
const crossFloor = computed(() => {
  if (!sourcePoint.value || !planRoom.value) return null
  const dh = getRoomHighlight(planRoom.value)
  if (!dh || sourcePoint.value.floor === dh.floor) return null
  const srcFloor  = sourcePoint.value.floor
  const dstFloor  = dh.floor
  const srcStairs = nearestStairs(sourcePoint.value, srcFloor)
  const side      = srcStairs?.side ?? 'left'
  const sideName  = side === 'left' ? 'Neuilly' : 'Paris'
  const dstLabel  = FLOORS.find(f => f.key === dstFloor)?.label
  return { srcFloor, dstFloor, side, sideName, dstLabel }
})

// Source pin shown on map only when it's on the active floor
const sourcePinOnActiveFloor = computed(() =>
  sourcePoint.value?.floor === active.value ? sourcePoint.value : null
)

// Stair pin shown on active floor during cross-floor navigation
const stairPin = computed(() => {
  const cf = crossFloor.value
  if (!cf) return null
  const s = STAIRS[active.value]?.[cf.side]
  return s ? { ...s, side: cf.side } : null
})

// ── Path drawing ──────────────────────────────────────────────────
function buildPath(src, dst, floor) {
  const pts = [[src.cx, src.cy]]

  if (floor === 'niveau2') {
    const srcLeft  = src.cx < 35
    const srcRight = src.cx > 65
    const dstLeft  = dst.cx < 35
    const dstRight = dst.cx > 65
    const CORRIDOR = 78

    if (srcLeft && dstRight || srcRight && dstLeft) {
      pts.push([src.cx, CORRIDOR], [dst.cx, CORRIDOR])
    } else if (srcLeft && !dstLeft && !dstRight || srcRight && !dstLeft && !dstRight) {
      pts.push([src.cx, 28], [dst.cx, dst.cy])
    } else if (!srcLeft && !srcRight && (dstLeft || dstRight)) {
      pts.push([dst.cx, 28])
    }
  } else if (floor === 'niveau1') {
    if ((src.cx < 50) !== (dst.cx < 50)) {
      pts.push([src.cx, 90], [dst.cx, 90])
    }
  }

  pts.push([dst.cx, dst.cy])
  return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ')
}

const navPath = computed(() => {
  const sp = sourcePoint.value
  if (!sp) return null
  const dh = getRoomHighlight(planRoom.value)
  if (!dh) return null

  if (sp.floor === dh.floor) {
    // Same floor: direct path (only draw on the active floor)
    if (active.value !== sp.floor) return null
    return buildPath(sp, dh, active.value)
  }

  // Cross-floor: route to/from stairs
  const cf = crossFloor.value
  if (!cf) return null

  if (active.value === cf.srcFloor) {
    // Source floor: user → stairs
    const stairs = nearestStairs(sp, cf.srcFloor)
    return stairs ? buildPath(sp, stairs, cf.srcFloor) : null
  }

  if (active.value === cf.dstFloor) {
    // Destination floor: stairs → room
    const dstStairs = STAIRS[cf.dstFloor]?.[cf.side]
    return dstStairs ? buildPath(dstStairs, dh, cf.dstFloor) : null
  }

  return null
})

// ── User interactions ─────────────────────────────────────────────
function onFrameClick(e) {
  if (!placingPin.value) return
  const rect = e.currentTarget.getBoundingClientRect()
  sourcePin.value = {
    cx: ((e.clientX - rect.left) / rect.width)  * 100,
    cy: ((e.clientY - rect.top)  / rect.height) * 100,
    floor: active.value,
  }
  placingPin.value = false
}

function clearSource() {
  sourcePin.value = null
  placingPin.value = false
}

watch(planRoom, name => {
  const h = getRoomHighlight(name)
  if (h) active.value = h.floor
  clearSource()
}, { immediate: true })

function togglePinMode() {
  placingPin.value = !placingPin.value
  if (placingPin.value) { sourcePin.value = null;  }
}

function onOverlayClick(e) {
  if (e.target === e.currentTarget) { closePlan(); emit('close') }
}
function onClose() { closePlan(); emit('close') }
</script>

<template>
  <Teleport to="body">
    <div class="overlay" @click="onOverlayClick">
      <div class="modal" role="dialog" aria-label="Plan du palais des congrès">

        <!-- Header -->
        <div class="modal-header">
          <span class="modal-title">🗺 Plan</span>
          <div class="tabs">
            <button
              v-for="f in FLOORS" :key="f.key"
              :class="['tab', { active: active === f.key }]"
              @click="active = f.key; placingPin = false"
            >
              <span class="tab-label">{{ f.label }}</span>
              <span class="tab-sub">{{ f.sub }}</span>
            </button>
          </div>
          <button class="close-btn" @click="onClose">✕</button>
        </div>

        <!-- Map -->
        <div class="map-wrap">
          <div
            class="img-frame"
            :class="{ 'img-frame--placing': placingPin }"
            @click="onFrameClick"
          >
            <img :key="activeFloor.key" :src="activeFloor.src" :alt="activeFloor.label" class="map-img" />

            <!-- SVG path overlay -->
            <svg v-if="navPath" class="path-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path
                :d="navPath"
                class="nav-path"
                fill="none"
                stroke="#38bdf8"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                vector-effect="non-scaling-stroke"
              />
            </svg>

            <!-- Source pin (manually placed or from session) -->
            <div
              v-if="sourcePinOnActiveFloor"
              class="pin pin--source"
              :style="{ left: sourcePinOnActiveFloor.cx + '%', top: sourcePinOnActiveFloor.cy + '%' }"
            >
              <div class="pin-dot pin-dot--source" />
              <div class="pin-label">Vous êtes ici</div>
            </div>

            <!-- Stair pin (cross-floor navigation) -->
            <div
              v-if="stairPin"
              class="pin pin--stair"
              :style="{ left: stairPin.cx + '%', top: stairPin.cy + '%' }"
            >
              <div class="pin-dot pin-dot--stair" />
              <div class="pin-label pin-label--stair">Escaliers {{ stairPin.side === 'left' ? 'Neuilly' : 'Paris' }}</div>
            </div>

            <!-- Destination pin (pulsing yellow) -->
            <div
              v-if="destHighlight"
              class="pin"
              :style="{ left: destHighlight.cx + '%', top: destHighlight.cy + '%' }"
            >
              <div class="pin-ring" />
              <div class="pin-dot" />
            </div>

            <!-- Pin placement hint -->
            <div v-if="placingPin" class="place-hint">Cliquez pour vous situer</div>
          </div>
        </div>

        <!-- Navigation panel — only shown when opened from a room tag -->
        <div v-if="planRoom" class="nav-panel">
          <div class="nav-header">
            <span class="nav-title">
              🧭 Itinéraire vers <strong>{{ planRoom }}</strong>
            </span>
            <button v-if="hasSource" class="nav-clear" @click="clearSource">✕ Effacer</button>
          </div>

          <!-- Cross-floor info -->
          <div v-if="crossFloor" class="nav-cross-floor">
            Rejoignez les escaliers <strong>{{ crossFloor.sideName }}</strong>, puis passez au <strong>{{ crossFloor.dstLabel }}</strong>.
            <span class="nav-cross-hint">Basculez sur l'onglet {{ crossFloor.dstLabel }} pour voir la suite.</span>
          </div>

          <!-- Pin mode button -->
          <div class="nav-options">
            <button
              :class="['nav-opt', { 'nav-opt--active': placingPin }]"
              @click="togglePinMode"
            >
              {{ placingPin ? '↖ Cliquez sur le plan…' : '📍 Ma position' }}
            </button>
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

/* ── Header ── */
.modal-header {
  display: flex; align-items: center; gap: 1.5rem;
  padding: 1rem 1.5rem;
  flex-shrink: 0;
  background: rgba(15, 23, 42, 0.8);
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.modal-title { font-size: 1.25rem; font-weight: 700; color: #fff; }
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
.tab-sub   { font-size: 0.75rem; font-weight: 500; color: rgba(255,255,255,0.4); margin-top: 0.125rem; }
.tab.active { background: var(--accent); border-color: var(--accent); color: #fff; box-shadow: 0 4px 12px rgba(124,58,237,0.3); }
.tab.active .tab-sub { color: rgba(255,255,255,0.8); }
.tab:hover:not(.active) { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.9); }

.close-btn {
  width: 2.5rem; height: 2.5rem; border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.05);
  cursor: pointer; font-size: 1rem; color: #fff;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s; flex-shrink: 0;
}
.close-btn:hover { background: #ef4444; border-color: #ef4444; }

/* ── Map ── */
.map-wrap {
  flex: 1; overflow: auto;
  display: flex; align-items: center; justify-content: center;
  padding: 2rem;
}

.img-frame {
  position: relative;
  display: inline-block;
  line-height: 0;
}
.img-frame--placing { cursor: crosshair; }

.map-img {
  display: block;
  max-width: calc(100vw - 4rem);
  max-height: calc(100vh - 14rem);
  filter: drop-shadow(0 20px 50px rgba(0,0,0,0.5));
}

/* ── SVG path overlay ── */
.path-svg {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  pointer-events: none;
}

.nav-path {
  stroke-dasharray: 6 4;
  animation: dash-flow 0.8s linear infinite;
}
@keyframes dash-flow {
  to { stroke-dashoffset: -10; }
}

/* ── Pins ── */
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
  box-shadow: 0 0 0 3px rgba(250,204,21,0.5);
  z-index: 2;
}

.pin-dot--source {
  background: #38bdf8;
  box-shadow: 0 0 0 3px rgba(56,189,248,0.5);
  width: 12px; height: 12px;
}

.pin-dot--stair {
  background: #fb923c;
  box-shadow: 0 0 0 3px rgba(251,146,60,0.5);
  width: 12px; height: 12px;
  border-radius: 3px;
}

.pin-label--stair { background: #fb923c; color: #fff; }

.pin-label {
  position: absolute;
  top: 12px; left: 50%; transform: translateX(-50%);
  background: #38bdf8; color: #0c1a2b;
  font-size: 0.6rem; font-weight: 800;
  padding: 2px 6px; border-radius: 4px;
  white-space: nowrap;
}

.pin-ring {
  width: 52px; height: 52px; border-radius: 50%;
  border: 3px solid #facc15; opacity: 0;
  animation: ping 1.4s cubic-bezier(0,0,0.2,1) infinite;
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
}
@keyframes ping {
  0%   { transform: translate(-50%, -50%) scale(0.5); opacity: 0.9; }
  100% { transform: translate(-50%, -50%) scale(1.8); opacity: 0; }
}

.place-hint {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  background: rgba(56,189,248,0.15);
  border: 1px dashed #38bdf8;
  color: #38bdf8; font-size: 0.85rem; font-weight: 700;
  padding: 0.5rem 1rem; border-radius: 8px;
  pointer-events: none;
}

/* ── Navigation panel ── */
.nav-panel {
  flex-shrink: 0;
  background: rgba(10, 18, 35, 0.95);
  border-top: 1px solid rgba(255,255,255,0.1);
  padding: 0.75rem 1.5rem;
  display: flex; flex-direction: column; gap: 0.5rem;
}

.nav-header {
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
}

.nav-title { font-size: 0.82rem; color: rgba(255,255,255,0.6); }
.nav-title strong { color: #fff; }

.nav-clear {
  font-size: 0.75rem; font-weight: 700; color: #ef4444;
  border: 1px solid rgba(239,68,68,0.3); border-radius: 6px;
  background: rgba(239,68,68,0.1); cursor: pointer; padding: 3px 10px;
  flex-shrink: 0;
}
.nav-clear:hover { background: rgba(239,68,68,0.2); }

.nav-cross-floor {
  font-size: 0.78rem; color: #fbbf24;
  background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.3);
  padding: 0.4rem 0.75rem; border-radius: 6px;
}
.nav-cross-hint { display: block; margin-top: 2px; font-size: 0.72rem; opacity: 0.7; }

.nav-options {
  display: flex; gap: 0.5rem;
  overflow-x: auto; padding-bottom: 2px;
}

.nav-opt {
  display: flex; flex-direction: column; align-items: flex-start; gap: 1px;
  padding: 0.35rem 0.75rem;
  border: 1px solid rgba(255,255,255,0.15); border-radius: 8px;
  background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.7);
  font-size: 0.75rem; cursor: pointer; white-space: nowrap; flex-shrink: 0;
  transition: all 0.15s;
}
.nav-opt:hover { background: rgba(255,255,255,0.1); color: #fff; }
.nav-opt--active {
  background: rgba(56,189,248,0.15); border-color: #38bdf8; color: #38bdf8;
}


@media (max-width: 768px) {
  .modal-header { flex-direction: column; align-items: stretch; gap: 1rem; }
  .tabs { overflow-x: auto; padding-bottom: 0.5rem; }
  .tab { flex: 0 0 auto; min-width: 140px; }
  .close-btn { position: absolute; top: 1rem; right: 1rem; }
}
</style>
