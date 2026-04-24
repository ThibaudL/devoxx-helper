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
          <h1>Mon planning</h1>
          <p class="subtitle">{{ totalCount }} conférence{{ totalCount !== 1 ? 's' : '' }} bookmarkée{{ totalCount !== 1 ? 's' : '' }}</p>
        </div>
        <div class="user-actions">
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
            <span v-if="day.conflictIds.size" class="stat-conflict" title="Conflits de planning">⚠ {{ day.conflictIds.size / 2 | 0 || 1 }} conflit{{ day.conflictIds.size > 2 ? 's' : '' }}</span>
          </div>
        </div>

        <section v-for="day in sessionsByDay" :key="day.value" class="day-section">
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
.stat-conflict { font-size: 0.75rem; color: #f59e0b; font-weight: 600; }

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
</style>
