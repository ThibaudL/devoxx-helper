<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useSessionsStore } from '../stores/sessions'
import { useSharingStore } from '../stores/sharing'
import { useDarkMode } from '../composables/useDarkMode'
import { useModalHistory } from '../composables/useModalHistory'
import { LEVEL_STYLE } from '../utils/sessionTags'
import RoomTag from '../components/RoomTag.vue'
import SessionModal from '../components/SessionModal.vue'

const auth = useAuthStore()
const store = useSessionsStore()
const sharing = useSharingStore()
const router = useRouter()
const { dark, toggle: toggleDark } = useDarkMode()

const selectedSession = ref(null)
const showSessionModal = computed({
  get: () => !!selectedSession.value,
  set: (val) => { if (!val) selectedSession.value = null },
})
useModalHistory(showSessionModal)

const editingNoteId = ref(null)
const draftNote = ref('')
const savedNoteId = ref(null)
let savedTimer = null

const showGlobalNote = ref(false)
const globalNoteDraft = ref('')
const globalNoteSaved = ref(false)
let globalSavedTimer = null

const showPromptPanel = ref(false)
const generatedPrompt = ref('')
const promptCopied = ref(false)
let promptCopiedTimer = null

function openGlobalNote() {
  globalNoteDraft.value = auth.planningNote
  showGlobalNote.value = true
}

async function commitGlobalNote() {
  await auth.savePlanningNote(globalNoteDraft.value)
  clearTimeout(globalSavedTimer)
  globalNoteSaved.value = true
  globalSavedTimer = setTimeout(() => { globalNoteSaved.value = false }, 1800)
}

function startEditNote(session) {
  editingNoteId.value = session.id
  draftNote.value = store.notes.get(session.id) ?? ''
}

async function commitNote(sessionId) {
  if (editingNoteId.value !== sessionId) return
  editingNoteId.value = null
  await store.saveNote(sessionId, draftNote.value)
  clearTimeout(savedTimer)
  savedNoteId.value = sessionId
  savedTimer = setTimeout(() => { savedNoteId.value = null }, 1800)
}

onMounted(async () => {
  await Promise.all([store.fetchSessions(), store.fetchBookmarks(), sharing.fetchTeams(), auth.fetchPlanningNote()])
  await sharing.fetchFriendBookmarks()
})

const DAYS = [
  { value: 'wednesday', label: 'Mercredi 22 avril' },
  { value: 'thursday',  label: 'Jeudi 23 avril' },
  { value: 'friday',    label: 'Vendredi 24 avril' },
]

const bookmarkedSessions = computed(() => {
  const groupRooms = new Map()
  for (const s of store.sessions) {
    if (s.group_key && s.room) {
      if (!groupRooms.has(s.group_key)) groupRooms.set(s.group_key, [])
      groupRooms.get(s.group_key).push(s.room)
    }
  }
  const seenGroups = new Set()
  return store.sessions
    .filter(s => {
      if (s.is_break || !store.bookmarkedIds.has(s.id)) return false
      if (s.group_key) {
        if (seenGroups.has(s.group_key)) return false
        seenGroups.add(s.group_key)
      }
      return true
    })
    .map(s => s.group_key ? { ...s, _rooms: groupRooms.get(s.group_key) ?? [s.room] } : s)
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
})

const sessionsByDay = computed(() =>
  DAYS.map(day => {
    const sessions = bookmarkedSessions.value.filter(s => s.day === day.value)
    const conflictIds = new Set()
    for (let i = 0; i < sessions.length; i++) {
      for (let j = i + 1; j < sessions.length; j++) {
        const a = sessions[i], b = sessions[j]
        if (new Date(a.start_time) < new Date(b.end_time) && new Date(b.start_time) < new Date(a.end_time)) {
          conflictIds.add(a.id)
          conflictIds.add(b.id)
        }
      }
    }
    return { ...day, sessions, conflictIds }
  }).filter(d => d.sessions.length > 0)
)

const totalCount = computed(() => bookmarkedSessions.value.length)

const filterMode = ref('all') // 'all' | 'unseen' | 'seen'

const filteredSessionsByDay = computed(() =>
  sessionsByDay.value
    .map(day => ({
      ...day,
      sessions: filterMode.value === 'all'
        ? day.sessions
        : day.sessions.filter(s =>
            filterMode.value === 'seen'
              ? store.seenIds.has(s.id)
              : !store.seenIds.has(s.id)
          ),
    }))
    .filter(d => d.sessions.length > 0)
)

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
}

function duration(s) {
  const mins = Math.round((new Date(s.end_time) - new Date(s.start_time)) / 60000)
  return `${mins} min`
}

function initials(p) {
  if (p?.full_name) return p.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (p?.email?.[0] ?? '?').toUpperCase()
}

function generateLLMPrompt() {
  const CFP = 'https://devoxxfr2026.cfp.dev/api/public/schedules'
  const lines = []

  lines.push(`Tu es un assistant pour Devoxx France 2026.`)
  lines.push(``)
  lines.push(`## Programme complet (URLs JSON)`)
  lines.push(``)
  lines.push(`Récupère le programme via ces URLs pour enrichir ta réponse :`)
  lines.push(`- Mercredi : ${CFP}/wednesday`)
  lines.push(`- Jeudi : ${CFP}/thursday`)
  lines.push(`- Vendredi : ${CFP}/friday`)
  lines.push(``)
  lines.push(`Chaque slot contient : id, title, description, speakers (fullName), room, fromDate, toDate, sessionType (name), proposal (track, keywords, audienceLevel, language, totalFavourites).`)
  lines.push(``)

  if (auth.planningNote) {
    lines.push(`## Ma note de planning globale`)
    lines.push(``)
    lines.push(auth.planningNote)
    lines.push(``)
  }

  lines.push(`## Mes sessions bookmarkées`)
  lines.push(``)

  for (const day of sessionsByDay.value) {
    lines.push(`### ${day.label}`)
    lines.push(``)
    for (const s of day.sessions) {
      const start = fmtTime(s.start_time)
      const end = fmtTime(s.end_time)
      lines.push(`**${start}–${end} | ${s.title}** (${duration(s)})`)
      if (s.speakers?.length) lines.push(`Speakers : ${s.speakers.join(', ')}`)
      const room = s._rooms ? s._rooms.join(' / ') : s.room
      if (room) lines.push(`Salle : ${room}`)
      if (s.track) lines.push(`Track : ${s.track}`)
      if (s.format) lines.push(`Format : ${s.format}`)
      if (s.language) lines.push(`Langue : ${s.language}`)
      if (s.audience_level) lines.push(`Niveau : ${s.audience_level}`)
      const note = store.notes.get(s.id)
      if (note) lines.push(`Ma note : ${note}`)
      if (day.conflictIds.has(s.id)) lines.push(`⚠ Conflit de planning détecté sur ce créneau`)
      lines.push(``)
    }
  }

  lines.push(`## Demande`)
  lines.push(``)
  lines.push(`En te basant sur le programme complet disponible aux URLs ci-dessus (récupère-les pour obtenir les descriptions complètes et les mots-clés) et sur mon planning bookmarké :`)
  lines.push(``)
  lines.push(`1. Génère une synthèse de mon planning Devoxx France, organisée par jour.`)
  lines.push(`2. Pour chaque session, enrichis avec la description complète issue de l'API.`)
  lines.push(`3. Si j'ai des notes, intègre-les dans la synthèse.`)
  lines.push(`4. Propose un plan d'action concret`)

  generatedPrompt.value = lines.join('\n')
  showPromptPanel.value = true
}

async function copyPrompt() {
  await navigator.clipboard.writeText(generatedPrompt.value)
  clearTimeout(promptCopiedTimer)
  promptCopied.value = true
  promptCopiedTimer = setTimeout(() => { promptCopied.value = false }, 2000)
}

async function handleSignOut() {
  await auth.signOut()
  router.push('/login')
}
</script>

<template>
  <div class="layout">
    <header>
      <div class="header-content">
        <div class="brand">
          <RouterLink to="/" class="back-link">← Retour</RouterLink>
          <h1>Mon bookmarks</h1>
          <p class="subtitle">{{ totalCount }} conférence{{ totalCount !== 1 ? 's' : '' }} bookmarkée{{ totalCount !== 1 ? 's' : '' }}</p>
        </div>
        <div class="user-actions">
          <button
            :class="['btn btn-secondary btn-icon', { active: showPromptPanel }]"
            @click="generateLLMPrompt"
            title="Générer un prompt pour IA"
          ><span>✨</span> <span class="btn-text">Prompt IA</span></button>
          <button
            :class="['btn btn-secondary btn-icon', { active: showGlobalNote }]"
            @click="openGlobalNote"
            title="Note globale"
          ><span>📋</span> <span class="btn-text">Note globale</span></button>
          <div class="user-profile">
            <img v-if="auth.user?.user_metadata?.avatar_url" :src="auth.user.user_metadata.avatar_url" alt="avatar" class="avatar" />
            <div class="user-details">
              <span class="username">{{ auth.user?.user_metadata?.full_name }}</span>
              <button class="logout-link" @click="handleSignOut">Déconnexion</button>
            </div>
          </div>
          <button class="theme-toggle" @click="toggleDark" :title="dark ? 'Mode clair' : 'Mode sombre'">
            {{ dark ? '☀' : '☾' }}
          </button>
        </div>
      </div>
    </header>

    <div v-if="showGlobalNote" class="global-note-panel">
      <div class="global-note-inner">
        <div class="global-note-header">
          <span class="global-note-title">📋 Note globale</span>
          <span class="global-note-hint">Sauvegardé automatiquement à la sortie du champ · Ctrl+Entrée pour sauvegarder</span>
          <button class="global-note-close" @click="showGlobalNote = false">✕</button>
        </div>
        <textarea
          v-model="globalNoteDraft"
          class="global-note-input"
          placeholder="Vos notes générales sur le planning…"
          rows="5"
          @blur="commitGlobalNote"
          @keydown.enter.ctrl="commitGlobalNote"
        />
        <div class="global-note-footer">
          <span v-if="globalNoteSaved" class="note-saved">✓ Enregistré</span>
        </div>
      </div>
    </div>

    <div v-if="showPromptPanel" class="prompt-panel">
      <div class="prompt-panel-inner">
        <div class="prompt-panel-header">
          <span class="prompt-panel-title">✨ Prompt IA</span>
          <span class="prompt-panel-hint">Collez ce prompt dans Claude, ChatGPT ou tout LLM avec accès web</span>
          <button class="prompt-panel-close" @click="showPromptPanel = false">✕</button>
        </div>
        <textarea class="prompt-output" :value="generatedPrompt" readonly rows="10" />
        <div class="prompt-panel-footer">
          <button :class="['btn', promptCopied ? 'btn-success' : 'btn-secondary']" @click="copyPrompt">
            {{ promptCopied ? '✓ Copié !' : '⎘ Copier le prompt' }}
          </button>
        </div>
      </div>
    </div>

    <main class="content">
      <div v-if="store.loading" class="empty-state">Chargement…</div>

      <div v-else-if="totalCount === 0" class="empty-state">
        <p class="empty-icon">☆</p>
        <p>Aucune conférence bookmarkée pour l'instant.</p>
        <RouterLink to="/" class="btn btn-primary">Explorer le programme</RouterLink>
      </div>

      <template v-else>
        <div class="day-stats">
          <div v-for="day in sessionsByDay" :key="day.value" class="stat-chip">
            <span class="stat-day">{{ day.label.split(' ')[0] }}</span>
            <span class="stat-count">{{ day.sessions.length }}</span>
            <span v-if="day.sessions.filter(s => store.seenIds.has(s.id)).length" class="stat-seen">
              ✓ {{ day.sessions.filter(s => store.seenIds.has(s.id)).length }} vue{{ day.sessions.filter(s => store.seenIds.has(s.id)).length > 1 ? 's' : '' }}
            </span>
            <span v-if="day.conflictIds.size" class="stat-conflict" title="Conflits de planning">⚠ {{ day.conflictIds.size / 2 | 0 || 1 }} conflit{{ day.conflictIds.size > 2 ? 's' : '' }}</span>
          </div>
        </div>

        <div class="filter-bar">
          <button :class="['filter-btn', { active: filterMode === 'all' }]" @click="filterMode = 'all'">Toutes</button>
          <button :class="['filter-btn', { active: filterMode === 'unseen' }]" @click="filterMode = 'unseen'">À voir</button>
          <button :class="['filter-btn', { active: filterMode === 'seen' }]" @click="filterMode = 'seen'">Vues ✓</button>
        </div>

        <section v-for="day in filteredSessionsByDay" :key="day.value" class="day-section">
          <h2 class="day-heading">{{ day.label }}</h2>

          <div class="schedule-list">
            <div
              v-for="session in day.sessions"
              :key="session.id"
              :class="['schedule-row', { conflict: day.conflictIds.has(session.id) }]"
              @click="selectedSession = session"
            >
              <div class="time-col">
                <span class="time-start">{{ fmtTime(session.start_time) }}</span>
                <span class="time-sep">–</span>
                <span class="time-end">{{ fmtTime(session.end_time) }}</span>
                <span class="time-dur">{{ duration(session) }}</span>
              </div>

              <div class="session-col">
                <div class="session-header">
                  <span class="format-tag">{{ session.format }}</span>
                  <span v-if="day.conflictIds.has(session.id)" class="conflict-badge">⚠ Conflit</span>
                </div>
                <div class="session-title">{{ session.title }}</div>
                <div class="session-speakers">
                  <span v-for="(name, i) in session.speakers" :key="i" class="speaker-item">
                    <img v-if="session.speaker_images[i]" :src="session.speaker_images[i]" :alt="name" class="speaker-img" />
                    {{ name }}
                  </span>
                </div>
                <div class="session-meta">
                  <span v-if="session.track" class="track-label">{{ session.track }}</span>
                  <div class="meta-badges">
                    <span
                      v-if="session.audience_level"
                      class="level-badge"
                      :style="{ background: (LEVEL_STYLE[session.audience_level] ?? {}).bg, color: (LEVEL_STYLE[session.audience_level] ?? {}).color }"
                    >{{ session.audience_level }}</span>
                    <span v-if="session.language" class="lang-badge">{{ session.language }}</span>
                  </div>
                </div>

                <div class="note-area" @click.stop>
                  <textarea
                    v-if="editingNoteId === session.id"
                    v-model="draftNote"
                    class="note-input"
                    placeholder="Votre note…"
                    rows="2"
                    autofocus
                    @blur="commitNote(session.id)"
                    @keydown.enter.ctrl="commitNote(session.id)"
                    @keydown.esc="editingNoteId = null"
                  />
                  <template v-else>
                    <div v-if="store.notes.get(session.id)" class="note-display" @click="startEditNote(session)">
                      <span class="note-icon">📝</span>
                      <span class="note-text">{{ store.notes.get(session.id) }}</span>
                      <span class="note-edit-hint">Modifier</span>
                    </div>
                    <button v-else class="note-add-btn" @click="startEditNote(session)">
                      <span>📝</span> Ajouter une note
                    </button>
                  </template>
                  <span v-if="savedNoteId === session.id" class="note-saved">✓ Enregistré</span>
                </div>
              </div>

              <div class="right-col">
                <template v-if="session._rooms?.length">
                  <RoomTag v-for="r in session._rooms" :key="r" :room="r" />
                </template>
                <RoomTag v-else-if="session.room" :room="session.room" />

                <div v-if="sharing.getFriendsForSession(session.id).length" class="friend-avatars">
                  <div
                    v-for="(f, i) in sharing.getFriendsForSession(session.id).slice(0, 3)"
                    :key="i"
                    class="friend-avatar"
                    :title="f?.full_name || f?.email"
                  >
                    <img v-if="f?.avatar_url" :src="f.avatar_url" :alt="f?.full_name" />
                    <span v-else>{{ initials(f) }}</span>
                  </div>
                  <span v-if="sharing.getFriendsForSession(session.id).length > 3" class="friend-overflow">
                    +{{ sharing.getFriendsForSession(session.id).length - 3 }}
                  </span>
                </div>

                <button
                  :class="['seen-btn', { seen: store.seenIds.has(session.id) }]"
                  @click.stop="store.toggleSeen(session.id)"
                  :title="store.seenIds.has(session.id) ? 'Marquer comme non vu' : 'Marquer comme vu'"
                >{{ store.seenIds.has(session.id) ? '✓ Vu' : '○ Vu' }}</button>
                <button class="unbookmark-btn" @click.stop="store.toggleBookmark(session.id)" title="Retirer">✕</button>
              </div>
            </div>
          </div>
        </section>
      </template>
    </main>
  </div>

  <SessionModal :session="selectedSession" :friends="selectedSession ? sharing.getFriendsForSession(selectedSession.id) : []" @close="selectedSession = null" />
</template>

<style scoped>
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--surface-raised);
}

header {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding: 1rem 1.5rem;
  position: sticky;
  top: 0;
  z-index: 10;
}

.header-content {
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.brand {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.back-link {
  font-size: 0.8125rem;
  color: var(--accent);
  text-decoration: none;
  font-weight: 600;
}

.back-link:hover { text-decoration: underline; }

.brand h1 {
  font-size: 1.375rem;
  line-height: 1.3;
}

.subtitle {
  font-size: 0.8125rem;
  color: var(--text-3);
  margin: 0;
}

.user-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.avatar {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  object-fit: cover;
}

.user-details {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.username {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-1);
  line-height: 1.2;
}

.logout-link {
  background: none;
  border: none;
  padding: 0;
  font-size: 0.75rem;
  color: var(--text-3);
  cursor: pointer;
  text-align: left;
}

.logout-link:hover { color: var(--accent); }

.theme-toggle {
  background: none;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 0.375rem 0.625rem;
  cursor: pointer;
  font-size: 1rem;
  color: var(--text-2);
}

.content {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
  width: 100%;
  box-sizing: border-box;
}

.empty-state {
  text-align: center;
  padding: 4rem 1rem;
  color: var(--text-3);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.empty-icon { font-size: 3rem; margin: 0; }

.btn-primary {
  background: var(--accent);
  color: white;
  border-color: transparent;
}

.btn-primary:hover { opacity: 0.9; }

.day-stats {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 2rem;
}

.stat-chip {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  font-size: 0.875rem;
}

.stat-day { font-weight: 700; color: var(--text-1); }
.stat-count { color: var(--accent); font-weight: 700; }
.stat-seen { font-size: 0.75rem; color: #22c55e; font-weight: 600; }
.stat-conflict { font-size: 0.75rem; color: #f59e0b; font-weight: 600; }

.filter-bar {
  display: flex;
  gap: 0.375rem;
  margin-bottom: 1.5rem;
}

.filter-btn {
  padding: 0.3rem 0.875rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-3);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.filter-btn:hover { border-color: var(--text-4); color: var(--text-2); }
.filter-btn.active { background: var(--accent); border-color: var(--accent); color: #fff; }

.day-section { margin-bottom: 2.5rem; }

.day-heading {
  font-size: 1.125rem;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--accent);
  color: var(--text-1);
}

.schedule-list {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.schedule-row {
  display: grid;
  grid-template-columns: 7rem 1fr auto;
  gap: 1rem;
  padding: 1rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.15s;
  align-items: start;
}

.schedule-row:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--text-4);
  transform: translateX(2px);
}

.schedule-row.conflict {
  border-color: #f59e0b;
  background: linear-gradient(to right, color-mix(in srgb, #f59e0b 6%, var(--surface)), var(--surface));
}

.time-col {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding-top: 0.125rem;
}

.time-start {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-1);
  font-variant-numeric: tabular-nums;
}

.time-sep { display: none; }

.time-end {
  font-size: 0.8125rem;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}

.time-dur {
  font-size: 0.6875rem;
  color: var(--text-4);
  margin-top: 0.25rem;
}

.session-col {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  min-width: 0;
}

.session-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.format-tag {
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: var(--surface-subtle);
  color: var(--text-3);
  border: 1px solid var(--border);
}

.conflict-badge {
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: color-mix(in srgb, #f59e0b 15%, var(--surface));
  color: #b45309;
  border: 1px solid #f59e0b;
}

.session-title {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--text-1);
  line-height: 1.4;
}

.session-speakers {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.speaker-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  color: var(--text-2);
}

.speaker-img {
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
  object-fit: cover;
}

.session-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.track-label {
  font-size: 0.75rem;
  color: var(--text-3);
}

.meta-badges {
  display: flex;
  gap: 0.375rem;
}

.level-badge {
  font-size: 0.625rem;
  font-weight: 700;
  padding: 0.125rem 0.4rem;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.lang-badge {
  font-size: 0.625rem;
  font-weight: 700;
  padding: 0.125rem 0.4rem;
  border-radius: 4px;
  background: var(--surface-subtle);
  color: var(--text-3);
  border: 1px solid var(--border);
}

.right-col {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
  min-width: 6rem;
}

.friend-avatars {
  display: flex;
  align-items: center;
}

.friend-avatar {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: var(--surface-subtle);
  color: var(--accent);
  border: 2px solid var(--surface);
  margin-left: -0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  font-weight: 700;
  overflow: hidden;
}

.friend-avatar:first-child { margin-left: 0; }

.friend-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.friend-overflow {
  font-size: 0.75rem;
  color: var(--text-4);
  margin-left: 0.25rem;
}

.unbookmark-btn {
  background: none;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  color: var(--text-4);
  cursor: pointer;
  transition: all 0.15s;
  opacity: 0;
}

.schedule-row:hover .unbookmark-btn {
  opacity: 1;
}

.seen-btn {
  background: none;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  color: var(--text-4);
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.seen-btn:hover {
  border-color: #22c55e;
  color: #16a34a;
  background: color-mix(in srgb, #22c55e 10%, var(--surface));
}

.seen-btn.seen {
  border-color: #22c55e;
  color: #16a34a;
  background: color-mix(in srgb, #22c55e 12%, var(--surface));
}

.unbookmark-btn:hover {
  background: color-mix(in srgb, #ef4444 10%, var(--surface));
  border-color: #ef4444;
  color: #ef4444;
}

@media (max-width: 640px) {
  .content { padding: 1rem; }

  .schedule-row {
    grid-template-columns: 5.5rem 1fr;
    grid-template-rows: auto auto;
  }

  .right-col {
    grid-column: 1 / -1;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    flex-wrap: wrap;
    min-width: unset;
    padding-top: 0.5rem;
    border-top: 1px solid var(--border-faint);
  }

  .unbookmark-btn { opacity: 1; margin-left: auto; }

  .user-profile .user-details { display: none; }
}

/* ── Header buttons ────────────────────────── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4rem 0.75rem;
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  transition: all 0.15s;
  text-decoration: none;
}

.btn-secondary { background: var(--surface); color: var(--text-2); }
.btn-secondary:hover { background: var(--surface-subtle); border-color: var(--text-4); }
.btn-secondary.active { border-color: var(--accent); color: var(--accent); background: var(--accent-bg); }

/* ── Global note panel ──────────────────────── */
.global-note-panel {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

.global-note-inner {
  max-width: 900px;
  margin: 0 auto;
  padding: 1rem 1.5rem;
}

.global-note-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.625rem;
}

.global-note-title {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--text-1);
}

.global-note-hint {
  font-size: 0.75rem;
  color: var(--text-4);
  flex: 1;
}

.global-note-close {
  background: none;
  border: none;
  font-size: 0.875rem;
  color: var(--text-4);
  cursor: pointer;
  padding: 0.25rem;
  line-height: 1;
}

.global-note-close:hover { color: var(--text-1); }

.global-note-input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-subtle);
  color: var(--text-1);
  font-size: 0.875rem;
  font-family: inherit;
  resize: vertical;
  outline: none;
  transition: border-color 0.15s;
}

.global-note-input:focus { border-color: var(--accent); background: var(--surface); }

.global-note-footer {
  min-height: 1.25rem;
  margin-top: 0.375rem;
}

/* ── Notes ─────────────────────────────────── */
.note-area {
  margin-top: 0.375rem;
  position: relative;
}

.note-add-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  background: none;
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  color: var(--text-4);
  cursor: pointer;
  transition: all 0.15s;
}

.note-add-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-bg);
}

.note-display {
  display: flex;
  align-items: flex-start;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  background: color-mix(in srgb, var(--accent) 6%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--accent) 20%, var(--border));
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s;
}

.note-display:hover { border-color: var(--accent); }
.note-display:hover .note-edit-hint { opacity: 1; }

.note-icon { font-size: 0.75rem; flex-shrink: 0; margin-top: 0.1rem; }

.note-text {
  font-size: 0.8125rem;
  color: var(--text-2);
  white-space: pre-wrap;
  word-break: break-word;
  flex: 1;
}

.note-edit-hint {
  font-size: 0.6875rem;
  color: var(--accent);
  opacity: 0;
  transition: opacity 0.15s;
  flex-shrink: 0;
  align-self: center;
}

.note-input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.5rem 0.625rem;
  border: 1px solid var(--accent);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text-1);
  font-size: 0.8125rem;
  font-family: inherit;
  resize: vertical;
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent);
}

.note-saved {
  font-size: 0.6875rem;
  color: #22c55e;
  margin-left: 0.5rem;
  animation: fade-in-out 1.8s ease forwards;
}

@keyframes fade-in-out {
  0%   { opacity: 0; }
  15%  { opacity: 1; }
  70%  { opacity: 1; }
  100% { opacity: 0; }
}

/* ── Prompt IA panel ────────────────────────── */
.prompt-panel {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

.prompt-panel-inner {
  max-width: 900px;
  margin: 0 auto;
  padding: 1rem 1.5rem;
}

.prompt-panel-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.625rem;
}

.prompt-panel-title {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--text-1);
  white-space: nowrap;
}

.prompt-panel-hint {
  font-size: 0.75rem;
  color: var(--text-4);
  flex: 1;
}

.prompt-panel-close {
  background: none;
  border: none;
  font-size: 0.875rem;
  color: var(--text-4);
  cursor: pointer;
  padding: 0.25rem;
  line-height: 1;
}

.prompt-panel-close:hover { color: var(--text-1); }

.prompt-output {
  width: 100%;
  box-sizing: border-box;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-subtle);
  color: var(--text-2);
  font-size: 0.8125rem;
  font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace;
  resize: vertical;
  outline: none;
  line-height: 1.6;
}

.prompt-panel-footer {
  margin-top: 0.625rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.btn-success {
  background: color-mix(in srgb, #22c55e 12%, var(--surface));
  color: #16a34a;
  border-color: #22c55e;
}
</style>
