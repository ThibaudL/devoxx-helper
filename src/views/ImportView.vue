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
      <button class="back-btn" @click="router.push('/')">← Retour</button>
      <h1>Importer depuis Devoxx Companion</h1>
    </header>

    <div class="steps">
      <!-- step 1 -->
      <div class="step">
        <div class="step-number">1</div>
        <div class="step-content">
          <h2>Ouvre le Devoxx Companion et connecte-toi</h2>
          <p>Va sur <strong>m.devoxx.com/events/devoxxfr2026/schedule</strong> — assure-toi d'être connecté pour que tes likes soient chargés. </p>
        </div>
      </div>

      <!-- step 2 -->
      <div class="step">
        <div class="step-number">2</div>
        <div class="step-content">
          <h2>Ouvre la console DevTools</h2>
          <p>Appuie sur <kbd>F12</kbd> (ou <kbd>Cmd+Option+J</kbd> sur Mac) → onglet <strong>Console</strong>.</p>
        </div>
      </div>

      <!-- step 3 -->
      <div class="step">
        <div class="step-number">3</div>
        <div class="step-content">
          <h2>Colle ce script dans la console et appuie sur Entrée</h2>
          <p>Il lit directement la base Firestore dans l'IndexedDB de ton navigateur et copie tes favoris dans le presse-papiers — <strong>pas besoin de rafraîchir</strong>.</p>
          <div class="code-block">
            <pre class="script-code">{{ IDB_SCRIPT }}</pre>
            <button class="copy-btn" @click="copyStep1">{{ copied1 ? '✓ Copié !' : 'Copier' }}</button>
          </div>
          <p class="hint">Le script affiche le contenu brut de la base dans la console et tente de le copier dans le presse-papiers. Si « Copied to clipboard! » n'apparaît pas, sélectionne manuellement le JSON affiché dans la console et copie-le.</p>
        </div>
      </div>

      <!-- step 4 -->
      <div class="step">
        <div class="step-number">4</div>
        <div class="step-content">
          <h2>Colle ici le résultat</h2>
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
              <span class="matched-title">{{ s.title }}</span>
              <span class="matched-speaker">{{ s.speakers[0] }}</span>
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
  max-width: 680px;
  margin: 0 auto;
  padding: 1.5rem 1rem;
}

header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
}

.back-btn {
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  padding: 0.35rem 0.8rem;
  cursor: pointer;
  font-size: 0.85rem;
  white-space: nowrap;
}

h1 {
  font-size: 1.3rem;
  font-weight: 700;
  margin: 0;
  color: #111827;
}

.steps {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.step {
  display: flex;
  gap: 1rem;
}

.step-number {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #f97316;
  color: white;
  font-weight: 700;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
}

.step-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.step-content h2 {
  font-size: 1rem;
  font-weight: 700;
  margin: 0;
  color: #111827;
}

.step-content p {
  font-size: 0.9rem;
  color: #4b5563;
  line-height: 1.5;
  margin: 0;
}

kbd {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 0.8rem;
  font-family: monospace;
}

.code-block {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #1e1e2e;
  border-radius: 8px;
  padding: 0.75rem 1rem;
}

.code-block code,
.script-code {
  flex: 1;
  font-family: monospace;
  font-size: 0.78rem;
  color: #a6e3a1;
  background: none;
  padding: 0;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.5;
}

.copy-btn {
  border: 1px solid #444;
  border-radius: 4px;
  background: #313244;
  color: #cdd6f4;
  padding: 0.25rem 0.6rem;
  font-size: 0.75rem;
  cursor: pointer;
}

.copy-btn:hover { background: #45475a; }

.hint {
  font-size: 0.85rem;
  color: #6b7280;
  margin: 0;
}

.paste-area {
  width: 100%;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 0.75rem;
  font-family: monospace;
  font-size: 0.8rem;
  resize: vertical;
  box-sizing: border-box;
  color: #374151;
}

.paste-area:focus { outline: 2px solid #f97316; border-color: transparent; }

.feedback {
  font-size: 0.88rem;
  padding: 0.6rem 0.9rem;
  border-radius: 6px;
}
.feedback.error   { background: #fef2f2; color: #b91c1c; }
.feedback.info    { background: #eff6ff; color: #1d4ed8; }
.feedback.success { background: #f0fdf4; color: #166534; }

.matched-list {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  max-height: 260px;
  overflow-y: auto;
}

.matched-item {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #f3f4f6;
  font-size: 0.83rem;
}

.matched-item:last-child { border-bottom: none; }

.matched-title {
  font-weight: 600;
  color: #111827;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.matched-speaker { color: #6b7280; white-space: nowrap; }

.already {
  font-size: 0.72rem;
  color: #16a34a;
  white-space: nowrap;
}

.import-btn {
  padding: 0.65rem 1.5rem;
  background: #f97316;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
}

.import-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.import-btn:not(:disabled):hover { background: #ea6c0a; }
</style>
