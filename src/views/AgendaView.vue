<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useSessionsStore } from '../stores/sessions'
import { useSharingStore } from '../stores/sharing'
import { useDarkMode } from '../composables/useDarkMode'
import { usePlanModal } from '../composables/usePlanModal'
import { useModalHistory } from '../composables/useModalHistory'
import RoomTag from '../components/RoomTag.vue'

import SessionCard from '../components/SessionCard.vue'
import ShareModal from '../components/ShareModal.vue'
import PlanModal from '../components/PlanModal.vue'
import KeywordFilterModal from '../components/KeywordFilterModal.vue'
import ProfileModal from '../components/ProfileModal.vue'
import SessionModal from '../components/SessionModal.vue'
import TimelineView from './TimelineView.vue'

const auth = useAuthStore()
const store = useSessionsStore()
const sharing = useSharingStore()
const router = useRouter()
const showShareModal = ref(false)
const { showPlanModal, openPlan, closePlan } = usePlanModal()
const { dark, toggle: toggleDark } = useDarkMode()

const search = ref('')
const selectedDay = ref('')
const selectedTrack = ref('')
const selectedKeywords = ref(new Set())
const showKeywordModal = ref(false)
const showProfileModal = ref(false)
const selectedSession = ref(null)

useModalHistory(showShareModal)
useModalHistory(showKeywordModal)
useModalHistory(showProfileModal)

// For selectedSession, we need to adapt it since it's not a boolean
const showSessionModal = computed({
  get: () => !!selectedSession.value,
  set: (val) => { if (!val) selectedSession.value = null }
})
useModalHistory(showSessionModal)

// For plan modal which uses a composable
const showPlanModalRef = computed({
  get: () => showPlanModal.value,
  set: (val) => { if (!val) closePlan() }
})
useModalHistory(showPlanModalRef)

const bookmarkedKeywordsForProfile = computed(() =>
  [...new Set(store.sessions.filter(s => store.bookmarkedIds.has(s.id)).flatMap(s => s.keywords ?? []))]
)

function toggleKeyword(kw) {
  const s = new Set(selectedKeywords.value)
  s.has(kw) ? s.delete(kw) : s.add(kw)
  selectedKeywords.value = s
}
const onlyBookmarked = ref(false)
const hidePastSessions = ref(true)
const viewMode = ref('cards')

const DAYS = [
  { value: 'wednesday', label: 'Mercredi 22' },
  { value: 'thursday',  label: 'Jeudi 23' },
  { value: 'friday',    label: 'Vendredi 24' },
]

onMounted(async () => {
  await Promise.all([store.fetchSessions(), store.fetchBookmarks(), sharing.fetchTeams()])
  await sharing.fetchFriendBookmarks()
  nowTimer = setInterval(() => { now.value = new Date() }, 60_000)
})
onUnmounted(() => clearInterval(nowTimer))

const now = ref(new Date())
let nowTimer

const showNowPanel = ref(false)

const currentSessions = computed(() => {
  const t = now.value
  const current = store.sessions.filter(s =>
    !s.is_break && new Date(s.start_time) <= t && new Date(s.end_time) >= t
  )

  const groupRooms = new Map()
  for (const s of current) {
    if (s.group_key && s.room) {
      if (!groupRooms.has(s.group_key)) groupRooms.set(s.group_key, [])
      groupRooms.get(s.group_key).push(s.room)
    }
  }

  const seenGroups = new Set()
  return current.filter(s => {
    if (s.group_key) {
      if (seenGroups.has(s.group_key)) return false
      seenGroups.add(s.group_key)
    }
    return true
  }).map(s => s.group_key
    ? { ...s, _rooms: groupRooms.get(s.group_key) ?? [s.room] }
    : s
  )
})

const nextSessions = computed(() => {
  const t = now.value
  const upcoming = store.sessions
    .filter(s => !s.is_break && new Date(s.start_time) > t)
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
  if (!upcoming.length) return []
  const nextTime = upcoming[0].start_time
  const next = upcoming.filter(s => s.start_time === nextTime)

  const groupRooms = new Map()
  for (const s of next) {
    if (s.group_key && s.room) {
      if (!groupRooms.has(s.group_key)) groupRooms.set(s.group_key, [])
      groupRooms.get(s.group_key).push(s.room)
    }
  }

  const seenGroups = new Set()
  return next.filter(s => {
    if (s.group_key) {
      if (seenGroups.has(s.group_key)) return false
      seenGroups.add(s.group_key)
    }
    return true
  }).map(s => s.group_key
    ? { ...s, _rooms: groupRooms.get(s.group_key) ?? [s.room] }
    : s
  )
})

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
}

const onlyFriendBookmarked = ref(false)

const allKeywords = computed(() =>
  [...new Set(store.sessions.flatMap(s => s.keywords ?? []))].sort()
)

const keywordGroups = computed(() => {
  const trackCounts = new Map() // keyword → Map<track, count>
  for (const s of store.sessions) {
    if (!s.track || !s.keywords?.length) continue
    for (const kw of s.keywords) {
      if (!trackCounts.has(kw)) trackCounts.set(kw, new Map())
      const m = trackCounts.get(kw)
      m.set(s.track, (m.get(s.track) ?? 0) + 1)
    }
  }
  const groups = new Map()
  for (const kw of allKeywords.value) {
    const counts = trackCounts.get(kw)
    const group = counts?.size
      ? [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
      : 'Autre'
    if (!groups.has(group)) groups.set(group, [])
    groups.get(group).push(kw)
  }
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([group, keywords]) => ({ group, keywords }))
})

const bookmarkedKeywords = computed(() =>
  new Set(store.sessions.filter(s => store.bookmarkedIds.has(s.id)).flatMap(s => s.keywords ?? []))
)

const filtered = computed(() => {
  const q = search.value.toLowerCase()

  // Build room list per group_key from all sessions
  const groupRooms = new Map()
  for (const s of store.sessions) {
    if (s.group_key && s.room) {
      if (!groupRooms.has(s.group_key)) groupRooms.set(s.group_key, [])
      groupRooms.get(s.group_key).push(s.room)
    }
  }

  const seenGroups = new Set()
  return store.sessions.filter(s => {
    if (s.is_break) return false
    if (selectedDay.value && s.day !== selectedDay.value) return false
    if (selectedTrack.value && s.track !== selectedTrack.value) return false
    if (selectedKeywords.value.size && !s.keywords?.some(k => selectedKeywords.value.has(k))) return false
    if (onlyBookmarked.value && !store.bookmarkedIds.has(s.id)) return false
    if (onlyFriendBookmarked.value && !sharing.allFriendBookmarkedIds.has(s.id)) return false
    if (hidePastSessions.value && new Date(s.end_time) < now.value) return false
    if (q && !s.title.toLowerCase().includes(q) && !s.speakers.join(' ').toLowerCase().includes(q)) return false
    if (s.group_key) {
      if (seenGroups.has(s.group_key)) return false
      seenGroups.add(s.group_key)
    }
    return true
  }).map(s => s.group_key
    ? { ...s, _rooms: groupRooms.get(s.group_key) ?? [s.room] }
    : s
  )
})

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
          <h1>Devoxx Helper</h1>
          <p class="subtitle">Votre compagnon pour Devoxx France 2026</p>
        </div>
        <div class="user-actions">
          <div class="action-group">
            <RouterLink to="/synthese" class="btn btn-secondary btn-icon" title="Mes bookmarks">
              <span>★</span> <span class="btn-text">Mon bookmarks</span>
            </RouterLink>
            <RouterLink to="/import" class="btn btn-secondary btn-icon" title="Importer">
              <span>⬇</span> <span class="btn-text">Importer</span>
            </RouterLink>
            <button
              class="btn btn-secondary btn-icon"
              @click="showProfileModal = true"
              title="Analyser mon profil"
            ><span>🧠</span> <span class="btn-text">Mon profil</span></button>
            <button class="btn btn-secondary btn-icon" @click="openPlan()" title="Plan">
              <span>🗺</span> <span class="btn-text">Plan</span>
            </button>
            <button class="btn btn-primary btn-icon" @click="showShareModal = true" title="Partager">
              <span>👥</span> <span class="btn-text">Partager</span>
            </button>
          </div>
          <div class="v-divider"></div>
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

    <div class="toolbar">
      <div class="view-toggle">
        <button :class="['view-btn', { active: viewMode === 'cards' }]" @click="viewMode = 'cards'">☰ Liste</button>
        <button :class="['view-btn', { active: viewMode === 'timeline' }]" @click="viewMode = 'timeline'">▦ Timeline</button>
      </div>
      <button :class="['now-btn', { active: showNowPanel }]" @click="showNowPanel = !showNowPanel">
        <span class="now-dot" />
        En ce moment
      </button>
    </div>

    <div v-if="showNowPanel" class="now-panel">
      <div v-if="currentSessions.length" class="now-section">
        <div class="now-section-header">
          <p class="now-label">🔴 En cours</p>
          <button class="now-close" @click="showNowPanel = false">
            <span v-if="dark">✕</span>
            <span v-else>✕</span>
          </button>
        </div>
        <div class="now-list">
          <div
            v-for="s in currentSessions" :key="s.id"
            :class="['now-card',
              store.bookmarkedIds.has(s.id) && 'now-card--mine',
              !store.bookmarkedIds.has(s.id) && sharing.getFriendsForSession(s.id).length && 'now-card--team'
            ]"
            @click="selectedSession = s"
          >
            <div class="now-card-time">{{ fmtTime(s.start_time) }} – {{ fmtTime(s.end_time) }}</div>
            <div class="now-card-title">{{ s.title }}</div>
            <div class="now-card-meta">
              <template v-if="s._rooms?.length">
                <RoomTag v-for="r in s._rooms" :key="r" :room="r" />
              </template>
              <RoomTag v-else-if="s.room" :room="s.room" />
              <span v-if="s.speakers.length">· {{ s.speakers.join(', ') }}</span>
            </div>
            <div class="now-card-badges">
              <span v-if="store.bookmarkedIds.has(s.id)" class="now-badge now-badge--mine">♥ Mon agenda</span>
              <template v-if="sharing.getFriendsForSession(s.id).length">
                <span
                  v-for="(f, i) in sharing.getFriendsForSession(s.id).slice(0, 3)" :key="i"
                  class="now-badge now-badge--friend"
                  :title="f?.full_name || f?.email"
                >{{ (f?.full_name || f?.email || '?').split(' ')[0] }}</span>
                <span v-if="sharing.getFriendsForSession(s.id).length > 3" class="now-badge now-badge--friend">
                  +{{ sharing.getFriendsForSession(s.id).length - 3 }}
                </span>
              </template>
            </div>
          </div>
        </div>
      </div>

      <div v-if="!currentSessions.length && nextSessions.length" class="now-section-header now-section-header--standalone">
        <p class="now-label">⏭ Prochainement</p>
        <button class="now-close" @click="showNowPanel = false">
          <span v-if="dark">✕</span>
          <span v-else>✕</span>
        </button>
      </div>

      <div v-if="nextSessions.length" class="now-section">
        <p v-if="currentSessions.length" class="now-label">⏭ Prochainement · {{ fmtTime(nextSessions[0].start_time) }}</p>
        <p v-else class="now-label">{{ fmtTime(nextSessions[0].start_time) }}</p>
        <div class="now-list">
          <div
            v-for="s in nextSessions" :key="s.id"
            :class="['now-card',
              store.bookmarkedIds.has(s.id) && 'now-card--mine',
              !store.bookmarkedIds.has(s.id) && sharing.getFriendsForSession(s.id).length && 'now-card--team'
            ]"
            @click="selectedSession = s"
          >
            <div class="now-card-title">{{ s.title }}</div>
            <div class="now-card-meta">
              <template v-if="s._rooms?.length">
                <RoomTag v-for="r in s._rooms" :key="r" :room="r" />
              </template>
              <RoomTag v-else-if="s.room" :room="s.room" />
              <span v-if="s.speakers.length">· {{ s.speakers.join(', ') }}</span>
            </div>
            <div class="now-card-badges">
              <span v-if="store.bookmarkedIds.has(s.id)" class="now-badge now-badge--mine">♥ Mon agenda</span>
              <template v-if="sharing.getFriendsForSession(s.id).length">
                <span
                  v-for="(f, i) in sharing.getFriendsForSession(s.id).slice(0, 3)" :key="i"
                  class="now-badge now-badge--friend"
                  :title="f?.full_name || f?.email"
                >{{ (f?.full_name || f?.email || '?').split(' ')[0] }}</span>
                <span v-if="sharing.getFriendsForSession(s.id).length > 3" class="now-badge now-badge--friend">
                  +{{ sharing.getFriendsForSession(s.id).length - 3 }}
                </span>
              </template>
            </div>
          </div>
        </div>
      </div>

      <div v-if="!currentSessions.length && !nextSessions.length" class="now-section-header now-section-header--standalone">
        <p class="now-label">En ce moment</p>
        <button class="now-close" @click="showNowPanel = false">
          <span v-if="dark">✕</span>
          <span v-else>✕</span>
        </button>
      </div>
      <p v-if="!currentSessions.length && !nextSessions.length" class="now-empty">
        Aucune session à venir.
      </p>
    </div>

    <div v-if="viewMode === 'timeline'" class="timeline-container">
      <TimelineView />
    </div>

    <div v-else class="main-content">
      <div class="filters">
        <input v-model="search" placeholder="Rechercher un talk ou speaker..." class="search" />
        <div class="filter-row">
          <button
            v-for="d in DAYS" :key="d.value"
            :class="['filter-btn', { active: selectedDay === d.value }]"
            @click="selectedDay = selectedDay === d.value ? '' : d.value"
          >{{ d.label }}</button>

          <button
            :class="['filter-btn', { active: selectedKeywords.size > 0 }]"
            @click="showKeywordModal = true"
          >
            🏷 Mots-clés{{ selectedKeywords.size ? ` (${selectedKeywords.size})` : '' }}
          </button>

          <button
            :class="['filter-btn', { active: onlyBookmarked }]"
            @click="onlyBookmarked = !onlyBookmarked"
          >★ Mes bookmarks ({{ store.bookmarkedIds.size }})</button>

          <button
            :class="['filter-btn', { active: hidePastSessions }]"
            @click="hidePastSessions = !hidePastSessions"
          >🕒 Masquer passés</button>

          <button
            v-if="sharing.teams.length"
            :class="['filter-btn', 'friend-filter', { active: onlyFriendBookmarked }]"
            @click="onlyFriendBookmarked = !onlyFriendBookmarked"
          >👥 Favoris amis ({{ sharing.allFriendBookmarkedIds.size }})</button>
        </div>
      </div>

      <div v-if="store.loading" class="empty">Chargement...</div>
      <div v-else-if="!filtered.length" class="empty">Aucun talk trouvé.</div>
      <div v-else class="grid">
        <SessionCard v-for="s in filtered" :key="s.id" :session="s" :friends="sharing.getFriendsForSession(s.id)" />
      </div>
    </div>
  </div>

  <ShareModal v-if="showShareModal" @close="showShareModal = false" />
  <PlanModal v-if="showPlanModal" @close="closePlan" />
  <KeywordFilterModal
    v-if="showKeywordModal"
    :groups="keywordGroups"
    :selected="selectedKeywords"
    :bookmarked="bookmarkedKeywords"
    @toggle="toggleKeyword"
    @reset="selectedKeywords = new Set()"
    @close="showKeywordModal = false"
  />
  <ProfileModal
    v-if="showProfileModal"
    :keywords="bookmarkedKeywordsForProfile"
    @close="showProfileModal = false"
  />

  <SessionModal
    :session="selectedSession"
    :friends="selectedSession ? sharing.getFriendsForSession(selectedSession.id) : []"
    @close="selectedSession = null"
  />
</template>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 0;
  overflow: hidden;
}

header {
  padding: 1.5rem 1rem 1rem;
  flex-shrink: 0;
}

.toolbar {
  padding: 0 1rem 1rem;
  flex-shrink: 0;
  margin-bottom: 0;
}

.filters {
  padding: 0 1rem 1rem;
  flex-shrink: 0;
  margin-bottom: 0;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 1rem 1.5rem;
}

.timeline-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0; /* Important for flex children */
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
}

.brand h1 {
  font-size: 1.75rem;
  margin-bottom: 0.25rem;
}

.subtitle {
  font-size: 0.9rem;
  color: var(--text-3);
  margin: 0;
}

.user-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.action-group {
  display: flex;
  gap: 0.5rem;
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
  border: 1px solid transparent;
}

.btn-primary {
  background: var(--accent);
  color: white;
}

.btn-primary:hover {
  filter: brightness(1.1);
  box-shadow: var(--shadow-sm);
}

.btn-secondary {
  background: var(--surface);
  border-color: var(--border);
  color: var(--text-2);
}

.btn-secondary:hover {
  background: var(--surface-subtle);
  border-color: var(--text-4);
}

.v-divider {
  width: 1px;
  height: 2rem;
  background: var(--border);
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.avatar {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  border: 2px solid var(--border);
}

.user-details {
  display: flex;
  flex-direction: column;
}

.username {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-1);
}

.logout-link {
  font-size: 0.75rem;
  color: var(--text-3);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
}

.logout-link:hover {
  color: #ef4444;
  text-decoration: underline;
}

.theme-toggle {
  background: var(--surface-subtle);
  border: 1px solid var(--border);
  border-radius: 50%;
  width: 2.25rem;
  height: 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
}

.theme-toggle:hover {
  background: var(--surface);
  border-color: var(--accent);
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0;
}

.view-toggle {
  display: flex;
  background: var(--surface-subtle);
  padding: 0.25rem;
  border-radius: var(--radius-lg);
  gap: 0.25rem;
}

.view-btn {
  padding: 0.4rem 1.25rem;
  border: none;
  background: transparent;
  color: var(--text-3);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
}

.view-btn.active {
  background: var(--surface);
  color: var(--accent);
  box-shadow: var(--shadow-sm);
}

.now-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  color: var(--text-2);
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
}

.now-btn:hover {
  border-color: var(--text-4);
}

.now-btn.active {
  background: #fef2f2;
  border-color: #fee2e2;
  color: #ef4444;
}

.now-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

.now-panel {
  margin: 0 1rem 1rem;
  flex-shrink: 0;
  max-width: 100%;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  padding: 1rem;
  box-shadow: var(--shadow-md);
  max-height: 40vh;
  overflow-y: auto;
  z-index: 10;
}
.now-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}
.now-section-header--standalone {
  margin-bottom: 0.5rem;
}
.now-close {
  background: none;
  border: none;
  color: var(--text-3);
  cursor: pointer;
  padding: 4px;
  font-size: 1.2rem;
  line-height: 1;
}
.now-close:hover {
  color: var(--text-1);
}
.now-section {
  margin-bottom: 1rem;
}
.now-section:last-child {
  margin-bottom: 0;
}
.now-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-4);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: block;
}

.now-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.now-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 1rem;
  background: var(--surface-subtle);
  transition: transform 0.2s, box-shadow 0.2s;
  cursor: pointer;
}

.now-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.now-card-time {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-3);
  margin-bottom: 0.25rem;
}

.now-card-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-1);
  line-height: 1.4;
  margin-bottom: 0.5rem;
}

.now-card-meta {
  font-size: 0.8125rem;
  color: var(--text-2);
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem;
}

.now-card-badges {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.now-badge {
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.now-badge--mine {
  background: #fef3c7;
  color: #92400e;
}

.now-badge--friend {
  background: #dbeafe;
  color: #1e40af;
}

.now-card--mine {
  border-left: 4px solid #f97316;
}

.now-card--team {
  border-left: 4px solid #3b82f6;
}

.filters {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2rem;
}

.search {
  padding: 0.75rem 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  color: var(--text-1);
  font-size: 1rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.search:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-bg);
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.filter-btn {
  padding: 0.5rem 1.25rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-2);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-btn:hover {
  background: var(--surface-subtle);
  border-color: var(--text-4);
}

.filter-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}

.filter-btn.friend-filter {
  color: #3b82f6;
  border-color: #3b82f6;
}

.filter-btn.friend-filter:hover {
  background: #eff6ff;
}

.filter-btn.friend-filter.active {
  background: #3b82f6;
  color: white;
}

select {
  padding: 0.5rem 2rem 0.5rem 1rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-2);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 1rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

.empty {
  text-align: center;
  padding: 4rem 2rem;
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px dashed var(--border);
  color: var(--text-3);
}

@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }
  
  .user-actions {
    justify-content: space-between;
    gap: 0.5rem;
  }

  .action-group { gap: 0.35rem; }

  .btn-text {
    display: none;
  }

  .btn-icon {
    padding: 0;
    width: 2.25rem;
    height: 2.25rem;
    justify-content: center;
  }

  .user-profile { gap: 0.5rem; }
  .user-details { display: none; }

  .toolbar { flex-direction: column; gap: 0.75rem; align-items: stretch; }
  .view-toggle { width: 100%; }
  .view-btn { flex: 1; padding: 0.4rem; }
  .now-btn { justify-content: center; }

  .filters { gap: 0.75rem; }
  .filter-row { gap: 0.5rem; }
  .filter-btn { padding: 0.4rem 0.8rem; font-size: 0.8rem; }
  select { padding: 0.4rem 1.75rem 0.4rem 0.75rem; font-size: 0.8rem; }
}
</style>
