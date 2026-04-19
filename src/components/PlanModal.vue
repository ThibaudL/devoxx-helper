<script setup>
import { ref } from 'vue'


const FLOORS = [
  { key: 'rdc',     label: 'Hall d\'exposition', sub: 'Exposants · Salle Maillot', src: '/hall exposition.jpg' },
  { key: 'niveau1', label: 'Niveau 1', sub: 'Salles 141–153', src: '/1er etage.jpg' },
  { key: 'niveau2', label: 'Niveau 2', sub: 'Salles 241–253', src: '/2eme etage.jpg' },
]

const active = ref('niveau2')

function onOverlayClick(e) {
  if (e.target === e.currentTarget) emit('close')
}

const emit = defineEmits(['close'])
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
          <button class="close-btn" @click="$emit('close')">✕</button>
        </div>

        <div class="map-wrap">
          <img
            v-for="f in FLOORS" :key="f.key"
            v-show="active === f.key"
            :src="f.src"
            :alt="f.label"
            class="map-img"
          />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0;
  background: #111827;
  display: flex; flex-direction: column;
  z-index: 100;
}

.modal {
  display: flex; flex-direction: column;
  width: 100%; height: 100%;
}

.modal-header {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.6rem 1rem;
  flex-shrink: 0;
  flex-wrap: wrap;
  background: rgba(0,0,0,0.5);
}

.modal-title {
  font-size: 1rem; font-weight: 700; color: #fff;
  margin-right: 0.25rem;
}

.tabs {
  display: flex; gap: 0.35rem; flex: 1; flex-wrap: wrap;
}

.tab {
  display: flex; flex-direction: column; align-items: center;
  padding: 0.3rem 0.75rem;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 8px;
  background: rgba(255,255,255,0.07);
  color: rgba(255,255,255,0.7);
  cursor: pointer;
  font-size: 0.8rem; font-weight: 600;
  line-height: 1.2;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.tab-sub { font-size: 0.65rem; font-weight: 400; color: rgba(255,255,255,0.4); }
.tab.active { background: #fff; border-color: #fff; color: #111827; }
.tab.active .tab-sub { color: #64748b; }
.tab:hover:not(.active) { background: rgba(255,255,255,0.15); }

.close-btn {
  margin-left: auto;
  border: none; background: none; cursor: pointer;
  font-size: 1.1rem; color: rgba(255,255,255,0.6); padding: 0.25rem;
}
.close-btn:hover { color: #fff; }

.map-wrap {
  flex: 1;
  overflow: auto;
  display: flex; align-items: center; justify-content: center;
}

.map-img {
  max-width: 100%; max-height: 100%;
  object-fit: contain;
}
</style>
