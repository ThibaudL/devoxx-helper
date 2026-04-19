<script setup>
import { ref, onMounted } from 'vue'

const props = defineProps({
  keywords: { type: Array, required: true },
})
const emit = defineEmits(['close'])

const profile = ref('')
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    const res = await fetch('/api/analyze-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: props.keywords }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Erreur serveur')
    profile.value = data.profile
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

function onOverlayClick(e) {
  if (e.target === e.currentTarget) emit('close')
}

// Very simple markdown-like rendering: bold **text** and line breaks
function renderProfile(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
}
</script>

<template>
  <Teleport to="body">
    <div class="overlay" @click="onOverlayClick">
      <div class="modal" role="dialog" aria-label="Analyse de profil">
        <div class="modal-header">
          <span class="modal-title">🧠 Mon profil développeur</span>
          <button class="close-btn" @click="emit('close')">✕</button>
        </div>

        <div class="keywords-used">
          <span class="kw-label">Basé sur {{ keywords.length }} mots-clés :</span>
          <div class="kw-list">
            <span v-for="kw in keywords" :key="kw" class="kw-chip">{{ kw }}</span>
          </div>
        </div>

        <div class="body">
          <div v-if="loading" class="loading">
            <div class="spinner" />
            <span>Analyse en cours…</span>
          </div>
          <div v-else-if="error" class="error">
            ⚠️ {{ error }}
          </div>
          <div v-else class="profile-text" v-html="renderProfile(profile)" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.45);
  z-index: 100;
  display: flex; align-items: center; justify-content: center;
  padding: 1rem;
}

.modal {
  background: var(--surface);
  border-radius: var(--radius-lg);
  width: 100%; max-width: 600px; max-height: 85vh;
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

.close-btn {
  border: none; background: none; cursor: pointer;
  font-size: 1rem; color: var(--text-3); padding: 0.2rem;
}
.close-btn:hover { color: var(--text-1); }

.keywords-used {
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--border-faint);
  flex-shrink: 0;
}
.kw-label { font-size: 0.72rem; font-weight: 600; color: var(--text-4); text-transform: uppercase; letter-spacing: 0.04em; display: block; margin-bottom: 0.5rem; }
.kw-list { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.kw-chip {
  font-size: 0.72rem; padding: 0.15rem 0.6rem; border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent); font-weight: 500;
}

.body { flex: 1; overflow-y: auto; padding: 1.25rem; }

.loading {
  display: flex; flex-direction: column; align-items: center; gap: 1rem;
  padding: 2rem; color: var(--text-3); font-size: 0.9rem;
}

.spinner {
  width: 32px; height: 32px; border-radius: 50%;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.error { color: #ef4444; font-size: 0.9rem; }

.profile-text {
  font-size: 0.9rem; line-height: 1.7; color: var(--text-2);
}
.profile-text :deep(strong) { color: var(--text-1); font-weight: 700; }
</style>
