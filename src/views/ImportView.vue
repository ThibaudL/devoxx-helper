<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionsStore } from '../stores/sessions'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const store = useSessionsStore()
const auth = useAuthStore()

const raw = ref('')
const status = ref(null) // { type: 'success'|'error'|'info', message }
const importing = ref(false)

const IDB_SCRIPT =
`(async () => {
  const dbs = await indexedDB.databases();
  const fsDb = dbs.find(d => d.name?.includes('firestore'));
  if (!fsDb) { console.error('No Firestore IDB found'); return; }

  const db = await new Promise((res, rej) => {
    const r = indexedDB.open(fsDb.name);
    r.onsuccess = () => res(r.result);
    r.onerror   = () => rej(r.error);
  });

  // Favorites are in remoteDocumentsV14, collectionGroup = 'favorites'
  // documentId format: {userId}_{talkId}
  const storeName = [...db.objectStoreNames].find(s => s.startsWith('remoteDocuments') && !s.includes('Global'));
  if (!storeName) { console.error('remoteDocuments store not found'); return; }

  const ids = [];
  await new Promise(res => {
    const tx  = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).openCursor();
    req.onsuccess = e => {
      const cursor = e.target.result;
      if (!cursor) { res(); return; }
      const { collectionGroup, documentId } = cursor.value;
      if (collectionGroup === 'favorites' && documentId && documentId !== '.meta') {
        ids.push(documentId.split('_').pop());
      }
      cursor.continue();
    };
    req.onerror = () => res();
  });

  console.log('Favorite talk IDs:', ids);
  try {
    await navigator.clipboard.writeText(JSON.stringify(ids));
    console.log('%cCopied to clipboard!', 'color:green;font-weight:bold');
  } catch {
    console.log('%cCopy manually:', 'color:orange;font-weight:bold', JSON.stringify(ids));
  }
})();`

const copied1 = ref(false)
async function copyStep1() {
  await navigator.clipboard.writeText(IDB_SCRIPT)
  copied1.value = true
  setTimeout(() => { copied1.value = false }, 2000)
}

function parseIds(text) {
  const data = JSON.parse(text)
  // Script output is already a plain array of ID strings
  if (Array.isArray(data)) return data.map(String)
  // Fallback: object keyed by id
  if (data && typeof data === 'object') {
    const keys = Object.keys(data).filter(k => data[k])
    if (keys.length) return keys.map(String)
  }
  return []
}

const preview = computed(() => {
  if (!raw.value.trim()) return null
  try {
    const ids = parseIds(raw.value)
    const matched = store.sessions.filter(s => ids.includes(s.id))
    return { ids, matched }
  } catch {
    return null
  }
})

async function doImport() {
  if (!preview.value?.matched.length) return
  importing.value = true
  status.value = null

  try {
    const toAdd = preview.value.matched.filter(s => !store.bookmarkedIds.has(s.id))
    for (const s of toAdd) {
      await store.toggleBookmark(s.id)
    }
    status.value = {
      type: 'success',
      message: `${toAdd.length} talk(s) importé(s) dans ton agenda. (${preview.value.matched.length - toAdd.length} déjà présents.)`,
    }
  } catch (e) {
    status.value = { type: 'error', message: 'Erreur lors de l\'import : ' + e.message }
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <div class="layout">
    <header>
      <button class="btn btn-secondary" @click="router.push('/')">← Retour</button>
      <h1>Importer depuis Devoxx Companion</h1>
    </header>

    <div class="steps">
      <!-- step 1 -->
      <div class="step">
        <div class="step-header">
          <div class="step-number">1</div>
          <h2>Ouvre le Devoxx Companion et connecte-toi</h2>
        </div>
        <div class="step-content">
          <p>Va sur <a href="https://m.devoxx.com/events/devoxxfr2026/schedule" target="_blank" rel="noopener">m.devoxx.com/events/devoxxfr2026/schedule</a> — assure-toi d'être connecté pour que tes likes soient chargés. </p>
        </div>
      </div>

      <!-- step 2 -->
      <div class="step">
        <div class="step-header">
          <div class="step-number">2</div>
          <h2>Ouvre la console DevTools</h2>
        </div>
        <div class="step-content">
          <p>Appuie sur <kbd>F12</kbd> (ou <kbd>Cmd+Option+J</kbd> sur Mac) → onglet <strong>Console</strong>.</p>
        </div>
      </div>

      <!-- step 3 -->
      <div class="step">
        <div class="step-header">
          <div class="step-number">3</div>
          <h2>Colle ce script dans la console et appuie sur Entrée</h2>
        </div>
        <div class="step-content">
          <p>Il lit directement la base Firestore dans l'IndexedDB de ton navigateur et copie tes favoris dans le presse-papiers — <strong>pas besoin de rafraîchir</strong>.</p>
          <div class="code-block">
            <pre class="script-code">{{ IDB_SCRIPT }}</pre>
            <button class="copy-btn" @click="copyStep1" :class="{ copied: copied1 }">
              {{ copied1 ? '✓ Copié !' : 'Copier' }}
            </button>
          </div>
          <p class="hint">Le script affiche le contenu brut de la base dans la console et tente de le copier dans le presse-papiers. Si « Copied to clipboard! » n'apparaît pas, sélectionne manuellement le JSON affiché dans la console et copie-le.</p>
        </div>
      </div>

      <!-- step 4 -->
      <div class="step">
        <div class="step-header">
          <div class="step-number">4</div>
          <h2>Colle ici le résultat</h2>
        </div>
        <div class="step-content">
          <textarea
            v-model="raw"
            class="paste-area"
            placeholder='Colle ici le contenu copié (commence par { ou [ )...'
            rows="6"
          />

          <div v-if="raw.trim() && !preview" class="feedback error">
            Format non reconnu — vérifie que tu as bien collé le résultat de la commande console.
          </div>

          <div v-if="preview" class="feedback info">
            <strong>{{ preview.matched.length }}</strong> talk(s) reconnu(s) sur {{ preview.ids.length }} ID(s) trouvés.
            <span v-if="!preview.matched.length"> — Aucune correspondance avec les sessions connues.</span>
          </div>

          <div v-if="preview?.matched.length" class="matched-list">
            <div v-for="s in preview.matched" :key="s.id" class="matched-item">
              <div class="matched-info">
                <span class="matched-title">{{ s.title }}</span>
                <span class="matched-speaker">{{ s.speakers[0] }}</span>
              </div>
              <span class="already" v-if="store.bookmarkedIds.has(s.id)">✓ déjà ajouté</span>
            </div>
          </div>

          <div v-if="status" class="feedback" :class="status.type">
            {{ status.message }}
          </div>

          <button
            v-if="preview?.matched.length"
            class="import-btn"
            :disabled="importing"
            @click="doImport"
          >
            {{ importing ? 'Import en cours…' : `Importer ${preview.matched.filter(s => !store.bookmarkedIds.has(s.id)).length} talk(s)` }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-bottom: 3rem;
}

header h1 {
  font-size: 1.5rem;
  margin: 0;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
}

.btn:hover {
  background: var(--surface-subtle);
  border-color: var(--text-4);
}

.steps {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.step {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.step-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  background: var(--surface-subtle);
  border-bottom: 1px solid var(--border);
}

.step-number {
  width: 1.75rem;
  height: 1.75rem;
  background: var(--accent);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.875rem;
  flex-shrink: 0;
}

.step-header h2 {
  font-size: 1.125rem;
  font-weight: 700;
  margin: 0;
  color: var(--text-1);
}

.step-content {
  padding: 1.5rem;
}

.step-content p {
  margin-bottom: 1rem;
  line-height: 1.6;
}

.step-content p:last-child {
  margin-bottom: 0;
}

.code-block {
  position: relative;
  background: var(--code-bg);
  border-radius: var(--radius-md);
  margin: 1.5rem 0;
  border: 1px solid var(--border);
}

.script-code {
  margin: 0;
  padding: 1rem;
  font-family: var(--mono);
  font-size: 0.8125rem;
  overflow-x: auto;
  color: var(--text-2);
  max-height: 200px;
}

.copy-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  padding: 0.375rem 0.75rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.copy-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.copy-btn.copied {
  background: #10b981;
  border-color: #10b981;
  color: white;
}

.hint {
  font-size: 0.875rem;
  color: var(--text-3);
  font-style: italic;
  display: block;
  margin-top: 1rem;
}

.paste-area {
  width: 100%;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-subtle);
  color: var(--text-1);
  font-family: var(--mono);
  font-size: 0.875rem;
  resize: vertical;
  margin-bottom: 1rem;
}

.paste-area:focus {
  outline: none;
  border-color: var(--accent);
  background: var(--surface);
}

.feedback {
  padding: 1rem;
  border-radius: var(--radius-md);
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.feedback.info { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
.feedback.error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
.feedback.success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }

.matched-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  max-height: 300px;
  overflow-y: auto;
  padding-right: 0.5rem;
}

.matched-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: var(--surface-subtle);
  border-radius: 6px;
  border: 1px solid var(--border);
}

.matched-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.matched-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-1);
}

.matched-speaker {
  font-size: 0.75rem;
  color: var(--text-3);
}

.already {
  font-size: 0.75rem;
  font-weight: 600;
  color: #10b981;
  white-space: nowrap;
}

.import-btn {
  width: 100%;
  padding: 0.75rem;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.import-btn:hover:not(:disabled) {
  filter: brightness(1.1);
  box-shadow: var(--shadow-md);
}

.import-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

kbd {
  background: var(--surface-subtle);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.1rem 0.4rem;
  font-family: var(--mono);
  font-size: 0.8125rem;
  box-shadow: 0 1px 0 rgba(0,0,0,0.2);
}
</style>
