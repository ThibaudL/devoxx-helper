<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  keywords: { type: Array, required: true },
})
const emit = defineEmits(['close'])

const copied = ref(false)

const prompt = computed(() =>
  `Voici les mots-clés des conférences que j'ai mis en favori à Devoxx France 2026 :

${props.keywords.join(', ')}

En te basant uniquement sur ces mots-clés, dresse un portrait de moi en tant que développeur : mon profil probable (rôle, spécialité), mes centres d'intérêt techniques, mon niveau d'expertise supposé, et ce que je cherche probablement à apprendre ou consolider. Sois direct et utilise des sections courtes.`
)

async function copy() {
  await navigator.clipboard.writeText(prompt.value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

function onOverlayClick(e) {
  if (e.target === e.currentTarget) emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div class="overlay" @click="onOverlayClick">
      <div class="modal" role="dialog" aria-label="Prompt profil développeur">
        <div class="modal-header">
          <span class="modal-title">🧠 Mon profil développeur</span>
          <button class="close-btn" @click="emit('close')">✕</button>
        </div>

        <div class="body">
          <template v-if="keywords.length">
            <p class="instructions">
              Copiez ce prompt et collez-le dans le LLM de votre choix
              (ChatGPT, Claude, Gemini…)
            </p>
            <div class="prompt-box">
              <pre class="prompt-text">{{ prompt }}</pre>
            </div>
            <button :class="['copy-btn', { copied }]" @click="copy">
              {{ copied ? '✓ Copié !' : 'Copier le prompt' }}
            </button>
          </template>
          <p v-else class="empty">
            Ajoutez des sessions à votre agenda pour générer votre profil.
          </p>
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
  width: 100%; max-width: 580px; max-height: 85vh;
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

.body {
  flex: 1; overflow-y: auto;
  padding: 1.25rem;
  display: flex; flex-direction: column; gap: 1rem;
}

.instructions {
  font-size: 0.85rem; color: var(--text-3); margin: 0;
}

.prompt-box {
  background: var(--surface-subtle);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 1rem;
  overflow-y: auto;
  max-height: 340px;
}

.prompt-text {
  font-family: inherit;
  font-size: 0.85rem; line-height: 1.6;
  color: var(--text-2);
  white-space: pre-wrap; word-break: break-word;
  margin: 0;
}

.copy-btn {
  align-self: flex-end;
  padding: 0.55rem 1.4rem;
  border-radius: var(--radius-md);
  border: none;
  background: var(--accent); color: white;
  font-size: 0.9rem; font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}
.copy-btn:hover { filter: brightness(1.1); }
.copy-btn.copied { background: #16a34a; }
.empty { font-size: 0.88rem; color: var(--text-3); text-align: center; padding: 2rem 0; margin: 0; }

@media (max-width: 580px) {
  .overlay { padding: 0; }
  .modal { height: 100%; max-height: 100vh; border-radius: 0; }
  .copy-btn { align-self: stretch; padding: 0.75rem; }
  .prompt-box { max-height: none; flex: 1; }
}
</style>
