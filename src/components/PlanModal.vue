<script setup>
import { ref } from 'vue'


const FLOORS = [
  { key: 'rdc',     label: 'Hall d\'exposition', sub: 'Exposants · Salle Maillot', src: '/1_plan_large.png' },
  { key: 'niveau1', label: 'Niveau 1', sub: 'Salles 141–153', src: '/1_Plan_first_floor.png' },
  { key: 'niveau2', label: 'Niveau 2', sub: 'Salles 241–253', src: '/1_Plan_second_floor.png' },
]

const active = ref('rdc')

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

.tabs {
  display: flex; gap: 0.75rem; flex: 1;
}

.tab {
  display: flex; flex-direction: column; align-items: flex-start;
  padding: 0.5rem 1rem;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-md);
  background: rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.6);
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.tab-label { font-size: 0.875rem; font-weight: 700; }
.tab-sub { font-size: 0.75rem; font-weight: 500; color: rgba(255,255,255,0.4); margin-top: 0.125rem; }

.tab.active {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
}
.tab.active .tab-sub { color: rgba(255,255,255,0.8); }

.tab:hover:not(.active) {
  background: rgba(255,255,255,0.1);
  border-color: rgba(255,255,255,0.2);
  color: rgba(255,255,255,0.9);
}

.close-btn {
  width: 2.5rem; height: 2.5rem;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.05);
  cursor: pointer;
  font-size: 1rem; color: #fff;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #ef4444;
  border-color: #ef4444;
}

.map-wrap {
  flex: 1;
  overflow: auto;
  display: flex; align-items: center; justify-content: center;
  padding: 2rem;
}

.map-img {
  max-width: 100%; max-height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 20px 50px rgba(0,0,0,0.5));
}

@media (max-width: 768px) {
  .modal-header {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }
  .tabs {
    overflow-x: auto;
    padding-bottom: 0.5rem;
  }
  .tab {
    flex: 0 0 auto;
    min-width: 140px;
  }
  .close-btn {
    position: absolute;
    top: 1rem;
    right: 1rem;
  }
}
</style>
