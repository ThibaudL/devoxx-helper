<script setup>
const props = defineProps({
  groups:    { type: Array, required: true }, // [{ group: string, keywords: string[] }]
  selected:  { type: Set,   required: true },
  bookmarked:{ type: Set,   default: () => new Set() },
})
const emit = defineEmits(['toggle', 'reset', 'close'])

function onOverlayClick(e) {
  if (e.target === e.currentTarget) emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div class="overlay" @click="onOverlayClick">
      <div class="modal" role="dialog" aria-label="Filtrer par mots-clés">
        <div class="modal-header">
          <span class="modal-title">Mots-clés</span>
          <div class="header-actions">
            <button v-if="selected.size" class="reset-btn" @click="emit('reset')">
              Réinitialiser ({{ selected.size }})
            </button>
            <button class="close-btn" @click="emit('close')">✕</button>
          </div>
        </div>

        <div class="cloud">
          <div v-for="{ group, keywords } in groups" :key="group" class="group">
            <p class="group-label">{{ group }}</p>
            <div class="group-keywords">
              <button
                v-for="kw in keywords" :key="kw"
                :class="['kw-btn', { active: selected.has(kw), bookmarked: bookmarked.has(kw) && !selected.has(kw) }]"
                @click="emit('toggle', kw)"
              >
                <span v-if="bookmarked.has(kw)" class="kw-star">★</span>{{ kw }}
              </button>
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
  background: rgba(0,0,0,0.4);
  z-index: 100;
  display: flex; align-items: center; justify-content: center;
  padding: 1rem;
}

.modal {
  background: var(--surface);
  border-radius: var(--radius-lg);
  width: 100%; max-width: 600px; max-height: 80vh;
  display: flex; flex-direction: column;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.modal-title { font-size: 1rem; font-weight: 700; color: var(--text-1); }
.header-actions { display: flex; align-items: center; gap: 0.5rem; }

.reset-btn {
  font-size: 0.78rem; font-weight: 600;
  padding: 0.3rem 0.75rem;
  border: 1px solid var(--accent); border-radius: 999px;
  background: none; color: var(--accent); cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.reset-btn:hover { background: var(--accent); color: white; }

.close-btn {
  border: none; background: none; cursor: pointer;
  font-size: 1rem; color: var(--text-3); padding: 0.2rem;
}
.close-btn:hover { color: var(--text-1); }

.cloud {
  overflow-y: auto;
  padding: 1rem 1.25rem;
  display: flex; flex-direction: column; gap: 1.25rem;
}

.group-label {
  font-size: 0.7rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--text-4);
  margin: 0 0 0.5rem;
}

.group-keywords {
  display: flex; flex-wrap: wrap; gap: 0.4rem;
}

.kw-btn {
  padding: 0.3rem 0.75rem;
  border-radius: 999px;
  border: 1.5px solid var(--border);
  background: var(--surface-subtle);
  color: var(--text-2);
  font-size: 0.8rem; font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}
.kw-btn:hover { border-color: var(--accent); color: var(--accent); }
.kw-btn.active { background: var(--accent); border-color: var(--accent); color: white; font-weight: 600; }
.kw-btn.bookmarked { border-color: #f97316; color: #f97316; background: color-mix(in srgb, #f97316 8%, var(--surface)); }
.kw-star { font-size: 0.65rem; margin-right: 0.2rem; }

@media (max-width: 600px) {
  .overlay { padding: 0; }
  .modal { height: 100%; max-height: 100vh; border-radius: 0; }
}
</style>
